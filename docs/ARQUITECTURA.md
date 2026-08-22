# Arquitectura Molino Control

## Fuente de verdad

- **Supabase** es la fuente de verdad para datos operativos y snapshots del Maestro.
- **IndexedDB/localStorage** sólo pueden considerarse caché o respaldo local; no deben sustituir el estado persistido.
- **GitHub** mantiene código y cambios versionados.
- **Vercel** publica la aplicación.

## Maestro

El Maestro se importa como snapshot completo, conservando:

- hojas;
- fila original;
- valores originales;
- fórmulas originales;
- hash de fila;
- historial de importaciones.

El snapshot actual validado debe mantener 21 hojas y 12.752 filas de `BASE DE DATOS`.

## INE

La lógica INE debe permanecer separada de la representación visual. El cálculo debe ejecutarse sobre una fuente persistida y auditable, permitiendo conciliar contra el Maestro sin modificar la fuente histórica.

## Despliegue

Los cambios funcionales se preparan en una rama, se prueban en preview y sólo después se integran a `main` y producción.
