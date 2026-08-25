# LYRA · ejecución controlada · 2026-08-25

## Objetivo de esta iteración
Aplicar mejoras que reducen falsos positivos y regresiones sin alterar los datos productivos.

## Cambio ejecutado
El informe profesional Sacos/Granel dejó de presentar `AF` contra KG de Granel como un control universal. AF se interpreta según la fórmula real del Maestro/CODIGOS; AX identifica SACOS/GRANEL; U conserva KG del Maestro.

## Motivo
La auditoría encontró productos y fórmulas donde AF representa una unidad derivada y no una cantidad física universal de sacos. Compararlo universalmente contra KG genera falsos errores.

## Protección
- Cambios hechos primero en rama `lyra/seguridad-qa-2026-08-25`.
- No se modificaron datos de Supabase en esta iteración.
- No se revocaron permisos RPC todavía porque existen superficies de compatibilidad que podrían romper login/reportes.
- No se eliminaron índices no utilizados.

## Riesgos de seguridad detectados
Supabase mantiene funciones SECURITY DEFINER expuestas a anon/authenticated, funciones con search_path mutable y leaked-password protection desactivada. Se remediarán en una iteración separada con pruebas de regresión.

## Criterio de promoción
No promover a `main` hasta que el build de la rama pase:
- sintaxis;
- integración idempotente;
- LYRA Report QA Semantics Check;
- ausencia de duplicados;
- validación de datos contra Maestro;
- smoke de login, documentos, despachos e informes.

## No determinado todavía
- Tratamiento final de 2.737 boletas sin cliente textual.
- Clasificación definitiva de 14 facturas negativas.
- Migración completa de credenciales heredadas a Supabase Auth/RBAC.
