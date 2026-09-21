# Auditoría n8n y Excel · 21 de septiembre de 2026

## Diagnóstico ejecutivo

La aplicación, Supabase y el despliegue de producción están operativos. La integración n8n existente prueba correctamente el transporte tokenizado, pero el repositorio de staging todavía documentaba una credencial Supabase privilegiada y escrituras directas. Ese contrato quedó reemplazado en esta rama por RPCs de alcance mínimo.

El riesgo principal no es el tamaño comprimido del Excel, sino su expansión y complejidad interna. Cargarlo entero en n8n puede agotar memoria. La arquitectura propuesta separa orquestación, descarga firmada, lectura streaming, staging y una futura publicación aprobada.

## Auditoría del Maestro validado

Archivo: `TODOS_EL_AÑO_2025_LIBRO_OPTIMO_VALIDADO_20260917.xlsx`

| Métrica | Resultado |
|---|---:|
| Hojas | 21 |
| Celdas inspeccionadas | 875.355 |
| Celdas no vacías | 746.121 |
| Fórmulas | 229.894 |
| Celdas con error de fórmula | 40.715 |
| Tablas dinámicas | 30 |
| Cachés de tabla dinámica | 7 |
| Dibujos | 13 |
| Gráficos | 2 |
| Vínculos externos / macros | 0 / 0 |

### Hojas críticas

| Hoja | Filas físicas | Filas sustantivas | Fórmulas | Errores | Tratamiento |
|---|---:|---:|---:|---:|---|
| `CODIGOS` | 97 | 97 | 28 | 0 | Obligatoria y staged |
| `BASE DE DATOS` | 13.524 | 13.524 | 164.996 | 0 | Obligatoria y staged |
| `GUIAS` | 8.411 | 669 | 12 | 0 | Opcional y staged; ignorar filas decorativas |
| `BOLETAS` | 6.996 | 472 | 0 | 0 | Auditada, no staged en fase 1 |
| `LIBRO` | 15.000 | 8.179 | 64.771 | 40.714 | Auditada; errores de lookup se agregan como advertencias |
| `NESTLE METAS` | — | — | — | 1 | Advertencia `#DIV/0!` |

Los errores de `LIBRO` son principalmente `#N/A` provenientes de `VLOOKUP` contra `BOLETAS`. No deben rechazar todo el archivo mientras las hojas obligatorias y los resultados operacionales requeridos sean válidos.

## Reglas derivadas para el importador

- No usar el atributo XML `<dimension>` como conteo de negocio.
- Considerar únicamente filas con valores sustantivos.
- Preservar fórmula y resultado en `source_data`.
- Normalizar una copia en `normalized_data`; nunca reemplazar el original.
- Clasificar errores de `LIBRO` como advertencias agregadas por columna y código.
- Rechazar por hoja obligatoria ausente/vacía, checksum distinto, archivo inválido o errores en hojas obligatorias.
- Mantener idempotencia por `usuario + tipo + checksum`.
- No publicar datos operacionales durante la validación.

## Inventario y brechas

| Área | Evidencia | Brecha | Corrección en staging |
|---|---|---|---|
| n8n | Workflows 01/02 y credencial Header Auth funcional | No existe procesador completo | Workflow 03 versionado e inactivo |
| Supabase | Tablas de staging y bucket privado existen | Sin políticas del bucket ni lease/reintentos | Migración 20260921 |
| Vercel | Producción `READY` en commit `34faf4f` | No contiene panel ni parser | Parser y panel agregados a la rama |
| GitHub | Rama `codex/n8n-integration-staging` separada | JSON/docs antiguos sugerían `sb_secret` | Workflows RPC y documentación corregidos |
| Excel | Maestro preservado y auditado | Carga completa puede exceder memoria | Lector streaming y lotes de 200 filas |

## Criterio de salida de staging

La fase solo puede considerarse **probada** después de completar una ejecución manual con el archivo auditado y demostrar:

1. checksum idéntico;
2. detección de las 21 hojas;
3. `CODIGOS=96` y `BASE DE DATOS=13.523` filas de datos aproximadamente, descontando encabezados;
4. `GUIAS` limitado a filas sustantivas;
5. errores de `LIBRO` registrados como advertencias agregadas;
6. cero escrituras en tablas operacionales;
7. reintento idempotente sin duplicar filas ni errores;
8. estado final visible en el panel de Molino Control.

Hasta cumplir esos ocho puntos, los componentes deben describirse como **diseñados/configurados**, no como publicados o verificados.
