# Integración Cloud — Molino Control

## Arquitectura

`Molino Control` mantiene el frontend existente mientras incorpora una capa cloud segura:

- Supabase Auth: sesión y autorización.
- `molino_app_snapshot()`: snapshot administrativo de clientes, productos, documentos, despachos y salud del Maestro.
- `maestro_public_health()`: health check sin filas comerciales.
- `molino-cloud.js`: cliente frontend con la publishable key; no contiene `service_role`.
- `/cloud`: consola de verificación y lectura cloud.

## Fuente de verdad

Supabase es la fuente persistente. IndexedDB/localStorage quedan como caché/compatibilidad del frontend heredado mientras se migran los módulos uno por uno.

## Siguiente integración

1. Sustituir las cargas de snapshot locales por consultas al cloud data layer.
2. Migrar edición de clientes, productos, documentos y despachos a Supabase.
3. Conectar Maestro/INE a la importación persistente y al historial de versiones.
4. Retirar progresivamente persistencia local de datos comerciales.
