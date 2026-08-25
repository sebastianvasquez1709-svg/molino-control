# Auditoría raíz Maestro · 2026-08-25

## Hallazgo principal
La fuente original `maestro_fuente_filas` contiene 22.791 filas y `BASE DE DATOS` contiene exactamente 12.752 filas de datos. La capa derivada `maestro_filas` estaba vacía, por lo que la aplicación podía presentar información parcial o desfasada.

## Errores repetidos identificados

### 1. No usar la fuente correcta para cada concepto
- `BASE DE DATOS` es la fuente operacional para líneas de Facturas, Boletas y Guías.
- `LIBRO` es fuente complementaria para `NOTA DE CREDITO` y `NOTA DE DEBITO`.
- Las columnas de comparación del LIBRO (`Q:T`) no son fuente confiable: existen 42 filas `#N/A` en el archivo.

### 2. Conversión numérica defectuosa
Los valores del LIBRO pueden aparecer como texto con notación científica (`-1.68E+08`, `-1.02E+08`). Las condiciones basadas en `jsonb_typeof(...)=number` convertían esos importes en cero.

Se creó `public.maestro_num(text)` para convertir de forma segura números normales y científicos.

Se corrigieron especialmente las NC 6678 y 6687, que estaban mostrando neto/total incorrectos.

### 3. Regla de sacos
No se debe inferir 25 kg para todos los productos.
Auditoría sobre BASE mostró:
- 10 kg: 641 registros de saco
- 25 kg: 10.459 registros
- 800 kg: 60 registros
- Granel: sin conversión a sacos

Los maestros de producto se actualizaron a partir del ratio observado `Salida (U) / VENTAS*SACOS (AF)` en la fuente, no por heurística de nombre.

### 4. Fórmulas del Maestro
Se comprobó sobre 12.752 filas:
- `AR = AQ * U`: 1 excepción.
- `AS = AR * 19%`: 0 excepciones.
- `AU = AR + AS + AT`: 1 excepción.

La única excepción corresponde a la fila 10.571, donde `AR` está hardcodeado y no utiliza la fórmula esperada. No se reescribió el Excel ni se inventó un valor nuevo; se conserva como anomalía de origen.

### 5. Conteos reconstruidos
- Maestro operacional: 12.752 filas.
- Clientes: 325 entidades normalizadas.
- Productos válidos: 39.
- Documentos: 10.409.
- Despachos: 9.544.
- Documentos BASE: 6.527 Facturas + 2.737 Boletas + 991 Guías ST + 1 Guía EA = 10.256.
- NC/ND LIBRO: 151 NC + 2 ND = 153.
- Total: 10.409.

### 6. Reconciliación documental
Se compararon 10.256 documentos BASE contra `public.documentos` por tipo+folio y montos `AR/AS/AU`:
- faltantes: 0
- diferencias de neto/IVA/total: 0

Se compararon 153 NC/ND LIBRO contra `public.documentos`:
- faltantes: 0
- diferencias de neto/IVA/total: 0

## Medidas permanentes

- Se eliminó el trigger automático que ejecutaba reconstrucciones dentro de la actualización de `maestro_importaciones`, porque podía provocar recursión y operaciones pesadas no controladas.
- `sync_maestro_operational()` ahora trabaja únicamente con la importación Maestro validada.
- El sincronizador aplica la conversión numérica segura para NC/ND.
- El sincronizador recalcula pesos por saco desde el ratio real de la fuente.
- Los alias de clientes se regeneran desde BASE de DATOS.

## Regla de no regresión
Una futura optimización no puede:
1. usar `LIBRO` para sustituir los datos operacionales de BASE;
2. tratar todos los sacos como 25 kg;
3. interpretar NC/ND como ventas positivas;
4. utilizar `Q:T` del LIBRO como fuente de verdad mientras existan `#N/A`;
5. convertir texto científico a cero por una comprobación de tipo JSON;
6. ejecutar reconstrucciones masivas desde triggers sin control transaccional.
