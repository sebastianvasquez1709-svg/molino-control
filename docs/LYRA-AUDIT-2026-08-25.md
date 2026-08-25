# LYRA — Auditoría Autónoma Molino Control · 2026-08-25

## Estado de la iteración

Modo LYRA iniciado. Primera pasada realizada sobre:
- Maestro Excel real `MAESTRO_2025_2026.xlsx.xlsx`.
- Supabase/PostgreSQL y funciones operativas.
- GitHub/código actual.
- Vercel/build/runtime.
- Informe Sacos/Granel.

Esta fase es de auditoría y protección. No se introducen cambios de alto riesgo sobre autenticación ni se fuerza una reinterpretación de datos históricos.

## Hallazgo 1 — CRÍTICO / Seguridad

`app.js` todavía contiene credenciales heredadas en frontend (`ADMIN_RUT` y `ACCESS_KEY`). El puente `molino-cloud.js` también conserva la credencial de login en memoria de navegador para reutilizarla en RPC locales.

Decisión LYRA: congelar funcionalidad actual y preparar migración aislada a Supabase Auth/RBAC. No eliminar el login actual en producción hasta contar con prueba equivalente.

## Hallazgo 2 — CORRECTO / Integridad de documentos

Se reconcilió la tabla `documentos` contra `maestro_fuente_filas`:
- BASE DE DATOS: 0 faltantes, 0 diferencias netas, 0 diferencias IVA, 0 diferencias total.
- LIBRO para NC/ND: 0 faltantes, 0 diferencias netas, 0 diferencias IVA, 0 diferencias total.

La representación científica de importes en JSON ya no genera ceros para NC/ND.

## Hallazgo 3 — CORRECTO / Unidades según Maestro

La inspección directa de `BASE DE DATOS` demuestra que `AF` no representa necesariamente peso físico de un saco. El Excel usa reglas de equivalencia determinadas por `CODIGOS`.

Ejemplos relevantes:
- G20 aparece como “GERMEN 20 KG”, pero la fórmula AF del Maestro lo divide por 25; por tanto la aplicación debe respetar el resultado del Maestro y no inventar 20 kg por saco.
- HLLAG20 también se denomina 20 KG, pero la fórmula AF del Maestro usa la regla de 25 en el resultado almacenado.
- Big Bag S800/SEMOL800 usa 800 kg por unidad en el resultado del Maestro.

Decisión LYRA: `CODIGOS + fórmula AF + valor almacenado del Maestro` tienen prioridad sobre inferencias por nombre de producto.

## Hallazgo 4 — IMPORTANTE / Informe Sacos-Granel

El RPC `molino_sacos_granel_report_v3` filtra `INFO` a `''` o `'1'`, excluye Notas de Crédito y clasifica por `AX` SACOS/GRANEL.

Esto es coherente con la situación actual porque no se encontraron filas INFO=2 en `BASE DE DATOS` de la importación auditada. Debe mantenerse como regla explícita, no como heurística.

Sin embargo, el bloque de QA del informe presenta `AF vs KG` para GRANEL como “mismatch”. Esto es semánticamente engañoso porque AF en el Maestro no es un contador físico de sacos de granel; depende de la fórmula de equivalencia del Excel.

Decisión LYRA: no alterar el cálculo de negocio todavía; el QA visual debe cambiarse a un indicador informativo, no a una condición de error.

## Hallazgo 5 — IMPORTANTE / Datos negativos

Existen 14 facturas con total negativo en BASE DE DATOS. Corresponden a folios 6713–6733 y deben conservarse porque así existen en el Maestro. No se deben reclasificar automáticamente como NC.

Las NC deben seguir identificándose por su tipo real y su fuente LIBRO/BASE, según el Maestro.

## Hallazgo 6 — INFORMACIÓN DE CLIENTES

La auditoría muestra 2.737 boletas con cliente nulo. Esto no se interpreta automáticamente como corrupción: son registros de `Boleta[BT]` y deben revisarse según la semántica del Maestro.

Decisión LYRA: no inventar clientes ni asignar un cliente genérico sin evidencia empresarial.

## Hallazgo 7 — CORRECTO / Duplicados

- Documentos duplicados por tipo+folio: 0.
- Despachos duplicados por `maestro_fila_hash`: 0.
- Despachos sin producto textual: 0.

## Hallazgo 8 — Vercel

Último deployment de producción revisado: `READY`, commit `b0d0324499d447be22ff109c0ba6cca12f715507`.
Build completado correctamente y sin errores de build reportados.
No se observaron warnings/errors runtime en la ventana consultada.

## Hallazgo 9 — Excel / fórmula estructural

La hoja BASE DE DATOS tiene 12.752 filas de datos y 21 hojas totales en el libro.
La auditoría XML confirma que existen bloques con fórmulas y bloques históricamente pegados/estáticos. Por ello la aplicación no debe asumir que “ausencia de fórmula” equivale a “dato inválido”.

Se identificó una excepción de fórmula relevante en la fila 10.571 que debe mantenerse como anomalía del Maestro, no corregirse inventando un valor.

## Causa raíz de la repetición de errores

Las fallas anteriores no eran únicamente bugs aislados. Se combinaban:
1. Datos fuente originales y datos derivados tratados como equivalentes.
2. Heurísticas por texto para unidades que deben venir de CODIGOS/fórmula.
3. Conversión numérica incompleta de valores almacenados como texto científico.
4. QA del informe interpretando AF de granel como si fuera un contador físico.
5. Cambios rápidos sobre producción antes de completar la regresión de todas las capas.

## Acciones LYRA siguientes

1. Mantener documentos y despachos reconciliados contra Maestro como estado FROZEN.
2. Corregir la semántica del bloque QA del informe Sacos/Granel en una modificación aislada y reversible.
3. Construir un motor común de reglas de unidades basado en CODIGOS/AF/AX para evitar heurísticas duplicadas.
4. Prototipar migración de autenticación a Supabase Auth/RBAC en entorno aislado antes de tocar el login estable.
5. Añadir pruebas de reconciliación automáticas Maestro → Supabase para documentos, NC/ND, kilos y sacos.
6. Repetir auditoría después de cada cambio y bloquear promoción si una reconciliación deja de ser 0 diferencias.

## Criterio de promoción

No se promoverá una corrección funcional hasta demostrar:
- reconciliación contra Maestro;
- cero duplicados introducidos;
- cero diferencias monetarias en documentos;
- reglas de unidades respetadas;
- ausencia de regresión en producción;
- build + runtime + UI validados.
