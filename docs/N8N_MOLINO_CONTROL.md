# Molino Control + n8n

Paquete inicial para conectar Molino Control con Supabase mediante n8n sin modificar datos operacionales.

## Contenido

- `supabase_n8n_molino_control_prueba.sql`: tablas aisladas, RLS, grants explícitos y bucket privado.
- `molino_control_n8n_01_conexion.json`: prueba manual n8n → Supabase.
- `molino_control_n8n_02_importacion.json`: webhook inicial que valida metadatos y crea un trabajo de importación.

## Orden obligatorio

1. Reactivar y respaldar el proyecto Supabase `Molino Control`.
2. Revisar la migración con Security Advisor.
3. Ejecutar la migración SQL.
4. Crear en n8n una credencial Supabase llamada `Molino Control Supabase` usando:
   - Host: `https://dadggurateghfumfcshz.supabase.co`
   - Secret Key: una clave `sb_secret_...` exclusiva para n8n.
5. Importar `molino_control_n8n_01_conexion.json`.
6. Asignar la credencial a `Registrar prueba en Supabase`.
7. Ejecutar manualmente y comprobar que aparece `Conexión n8n → Supabase validada`.
8. Importar `molino_control_n8n_02_importacion.json`, asignar credencial y mantenerlo inactivo.
9. Crear el procesador de Excel y sus pruebas antes de conectar el webhook con producción.

## Seguridad

- Nunca colocar la clave secreta en el navegador, GitHub, Vercel público o este archivo.
- Los workflows vienen inactivos.
- Las tablas no conceden acceso a `anon` ni `authenticated`.
- El Excel original se conserva en el bucket privado `excel-imports`.
- El webhook inicial recibe solo metadatos; todavía no publica documentos ni indicadores.

## Contrato inicial del webhook

```json
{
  "file_name": "TODOS_EL_AÑO_2025_2026_1.xlsx",
  "storage_path": "usuario/importaciones/archivo.xlsx",
  "checksum_sha256": "64_caracteres_hexadecimales",
  "requested_by": "uuid-del-usuario",
  "metadata": {
    "source": "molino-control"
  }
}
```

## Próxima fase

El workflow de procesamiento descargará el archivo desde Storage y comprobará `BASE DE DATOS`, `LIBRO`, `GUIAS` y `CODIGOS`. Las filas pasarán por `import_rows_staging`; ningún dato llegará a las tablas operacionales hasta superar las validaciones y una comparación contra las fórmulas actuales del Maestro.
