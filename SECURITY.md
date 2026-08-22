# Seguridad y operación

## Reglas de despliegue

- No publicar claves `service_role`, secretos ni tokens de administración en el frontend.
- Los datos operativos deben persistirse en Supabase; `localStorage`/IndexedDB se consideran caché local, no fuente de verdad.
- Los cambios de producción deben pasar por una rama y una revisión antes del merge.
- Las funciones administrativas deben validar sesión y rol en backend.

## Arquitectura de datos

El Excel Maestro se conserva como snapshot en Supabase y sirve de fuente para la capa de normalización y auditoría. La interfaz no debe sustituir los datos del servidor por un estado local permanente.
