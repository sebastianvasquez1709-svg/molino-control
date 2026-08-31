# Molino Control · Reingeniería V1 · 2026-08-31

## Objetivo

Reducir regresiones sin eliminar funciones operativas que ya funcionan. Esta fase no reescribe Molino Control desde cero: estabiliza contratos, corrige el flujo mensual de Existencia/Sacos/Granel y crea una transición segura hacia persistencia durable.

## Principios preservados

- Maestro Excel sigue siendo la fuente de reglas y parámetros.
- INE de ventas y Existencia/stock permanecen separados.
- INFO=1 alimenta la derivación INE; INFO=2 representa resumen/stock.
- Las 8 familias INE mantienen su orden fijo.
- Históricos mensuales no deben borrarse al cargar otro período.
- Facturas, Boletas, Guías, Clientes, Despachos, NC/ND, IVA, Clima y Maestro deben conservar sus rutas.
- No se inventan valores cuando el Registro no contiene un INE derivado validado.

## Cambios de arquitectura

### 1. Rama de reingeniería

Todo el trabajo se ejecutó primero en `reingenieria-v1-20260831`, sin modificar `main` durante la fase de prueba.

### 2. Pipeline Vercel consolidado

Se reemplaza la cadena superior `v9 -> v5 -> v4 -> v3` por `scripts/vercel-build-reingenieria-v1.sh`.

El nuevo orquestador:

- ejecuta el núcleo transaccional existente una sola vez;
- mantiene las protecciones acumuladas que demostraron funcionar;
- valida sintaxis de módulos críticos;
- ejecuta regresión específica de Informes Mensuales V2;
- comprueba rutas principales antes de permitir el deployment.

La deuda interna de parches dentro del núcleo no se elimina todavía: se reduce de forma progresiva para evitar una reescritura destructiva.

### 3. Historial durable de Registro de Existencia

Se añadió el puente transitorio:

- Supabase RPC: `molino_existence_state_local`
- cliente: `molino-cloud-state-v2.js`

Mientras exista el login local de compatibilidad, este puente permite listar, guardar y eliminar únicamente los Registros de Existencia del administrador validado. IndexedDB se mantiene como fallback y los períodos locales faltantes pueden migrarse a la nube.

Esta capa es temporal. La etapa final de seguridad sigue siendo Supabase Auth/RBAC completo.

### 4. Informes Mensuales V2

`existencia-reportes-mensuales.js` fue reingenierizado como `EXISTENCIA_REPORTES_MODELO_V2`.

Incluye modelos automáticos para:

1. INE (2)
2. ENVASE (3)
3. ENVASE
4. nestle sacos
5. Nestle y CPW
6. cpw graneles
7. nestle Graneles

Correcciones relevantes:

- Big Bag 800 KG: `SALIDA / 800`.
- Formato 10 KG: `SALIDA / 10`.
- Sacos 25 KG: `SALIDA / 25`.
- Granel: `SALIDA` en la semántica AF del Maestro.
- Los totales Nestlé/CPW/Granel suman solamente las filas que pertenecen al informe seleccionado.
- El granel no se presenta como cantidad física de sacos.
- El INE no se fabrica a partir del stock si no existe una derivación validada.
- Las fórmulas quedan disponibles en auditoría técnica, pero no se imprimen para Gerencia.
- La impresión utiliza un `iframe` aislado; no usa popup ni recarga la aplicación.

## Validaciones Vercel de la rama

El preview de la reingeniería pasó, entre otras, las siguientes comprobaciones:

- `CORE MODULES STATIC CHECK: PASS`
- `GUIDES RENDERER STATIC CHECK: PASS`
- `DISPATCH CONTROLS V12 CHECK: PASS`
- `PUBLIC MAESTRO HARDENING CHECK: PASS`
- `EXISTENCE LIVE SYNC V4 CHECK: PASS`
- `MONTHLY REPORTS V2: PASS`
- `BIG BAG 800 KG RULE: PASS`
- `FILTERED GRANEL TOTALS: PASS`
- `INE 8 FAMILIES: PASS`
- `IFRAME PRINT SAFETY: PASS`
- `CORE ROUTES REGRESSION: PASS`
- `DURABLE EXISTENCE BRIDGE ASSET: PASS`
- `SACOS/GRANEL MASTER RULES: PASS`

## Deuda técnica que NO se oculta

Esta fase no significa que toda la aplicación esté completamente reescrita.

Pendientes de una Fase 2 controlada:

1. Migrar el login de compatibilidad a Supabase Auth/RBAC y retirar PIN/RPC heredados.
2. Reducir gradualmente el monolito `app.js` y mover dominios a módulos estables.
3. Sustituir los parches históricos restantes por módulos fuente definitivos.
4. Normalizar persistencia durable de contactos y despachos con el mismo criterio usado para Existencia.
5. Incorporar E2E de navegador autenticado para todos los módulos, además de los checks estáticos y de datos.
6. Endurecer funciones `SECURITY DEFINER` y políticas RLS con mínimo privilegio después de migrar autenticación.

## Regla de continuación

No hacer cambios masivos simultáneos. Para cada dominio:

**fuente real -> contrato -> prueba -> preview -> comparación -> producción -> monitoreo**.
