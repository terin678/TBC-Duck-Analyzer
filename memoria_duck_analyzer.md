# TBC Duck Analyzer - Memoria del Proyecto

## Resumen del Proyecto
Duck Analyzer es una herramienta web para analizar reportes de WarcraftLogs (WCL) de World of Warcraft: The Burning Crusade. Escanea logs de combates, identifica consumibles, casteos, debuffs y habilidades clave para cada clase y especialización (como totems de chamanes, kicks, o Innervate). 

## Arquitectura y Flujo de Datos
1. **`server.js` (Backend Node.js)**
   - Actúa como proxy hacia la API v2 de WarcraftLogs usando GraphQL.
   - Utiliza una base de datos local SQLite (`database.sqlite`) para **cachear las respuestas** y no saturar la API de WCL ni ralentizar el renderizado repetitivo.
   - Genera dinámicamente el `filterExp` (filtros de WCL) leyendo `data.js` para pedirle a WCL únicamente los eventos de los IDs que queremos traquear.

2. **`public/js/data.js` (Base de Datos de Hechizos - Frontend)**
   - Aquí se definen todas las IDs a trackear.
   - Constantes principales: `SPELL_DB` (Habilidades mayores), `BUFF_DB` (Consumibles), y **`CLASS_ABILITY_TRACKING`**.
   - `CLASS_ABILITY_TRACKING` contiene por cada clase/spec dos listas principales:
     - `casts`: Habilidades que se cuentan de forma plana en el panel de Casts/Debuffs.
     - `debuffs`: Habilidades que generan una barra de "uptime" en la Timeline del jugador.

3. **`public/js/processor.js` (Motor Lógico - Frontend)**
   - `processPlayerData`: Recibe los eventos del log para un jugador y procesa toda la lógica.
   - Fases de procesamiento:
     - **Phase 1-3:** Procesado de Auras iniciales, buffs de consumibles (flask, potis, weapon oils), y detecciones generales.
     - **Phase 4:** El loop principal sobre los eventos de combate que genera:
       - **`castCounts`**: Conteo de hechizos lanzados (incluyendo lógica de `trackOnDamage` para skills de Melee que no generan eventos de "cast" como Heroic Strike, y detecciones de "low rank").
       - **`debuffTimeline`**: Generación de las barras de uptime para debuffs y tótems (ej. lógica de solapamiento y recortes de barra como en `air-totem` de chamanes).
       - **Lógicas Especiales:** Como la inyección dinámica de los *Innervate* recibidos (`applybuff` de la id 29166 a la id del propio jugador).

4. **`public/js/ui/` (Renderizado Visual - Frontend)**
   - `mainContent.js` y `modals.js`: Renderizan las ventanas de Gear Inspector, Timeline Global, y los paneles individuales de "Casts/Debuff".
   - Soporte para mantener varias ventanas abiertas simultáneamente.

## Últimos Cambios Realizados
- **Chamanes (Totems):** Lógica exclusiva (mutuamente excluyentes) implementada para los totems de aire (Windfury Totem y Grace of Air Totem). Al castear uno, se recorta la barra de tiempo del anterior en la Timeline.
- **Chamanes (Shocks):** Earth Shock añadido con `trackAllCasts: true` para que los que fueron usados para cortar (Kicks) aparezcan marcados como `(kick)` en las habilidades, pero también se cuenten como casts totales junto a Frost Shock y Flame Shock. Se han corregido y añadido IDs actualizados (ej. Frost Shock max rank TBC ID 25464).
- **Warrior Arms:** Añadido Mortal Strike y Heroic Strike (ID 29707 entre otros). Heroic Strike y Cleave se trackean por daño (`trackOnDamage: true`) debido a cómo WCL reporta los ataques "On Next Melee".
- **Druida (Innervate):** Modificado `processor.js` para crear una barra destacada color naranja (#ff7d0a) en la parte superior de la Timeline (Casts/Debuffs) de cualquier jugador que RECIBE un Innervate, indicando el nombre del druida que se lo lanzó.

## Notas para Sesiones Futuras
- **Manejo de Caché:** Si añades nuevas IDs a `data.js` o actualizas código y el navegador se queda atascado mostrando versiones viejas o la UI no carga `castCounts`, necesitas forzar la caché en el navegador (`Ctrl+Shift+R` o limpiando el network) o cambiar el parámetro `?v=X.X.X` en el `index.html`.
- Si las nuevas IDs no son recibidas por el `server.js`, borra el archivo `database.sqlite` y reinicia el servidor de node, así WCL devolverá un JSON fresco con la nueva Query que incluirá la nueva ID en su filterExp.
