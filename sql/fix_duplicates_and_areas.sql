-- ══════════════════════════════════════════════════════════════════
-- FIX: Registros duplicados y áreas vacías
-- Causa: PDF general cargado, sobreescribió totales y areas
-- 
-- NOTA: Este script es para reparar datos ACTUALES.
--       El bug de código fue corregido en fichadasService.js con:
--       - Detección de imports generales (isGeneralImport)
--       - Smart Merge mejorado (skip por importacion_id)
--       - guardarRegistros protegido (solo borra misma importación)
--       - guardarTotalMensual protegido (no sobreescribe sectoriales)
-- ══════════════════════════════════════════════════════════════════

-- ─── PASO 1: DIAGNÓSTICO ─────────────────────────────────────────
-- Ver todas las importaciones recientes (ajustar mes/año si es necesario)
SELECT id, nombre_archivo, area, periodo_mes, periodo_anio, 
       total_colaboradores, total_registros, fecha_importacion
FROM fichadas_importaciones
ORDER BY fecha_importacion DESC
LIMIT 20;

-- Identificar imports GENERALES (area vacía, null, o "SANATORIO ARGENTINO")
SELECT id, nombre_archivo, area, periodo_mes, periodo_anio,
       total_colaboradores, fecha_importacion,
       CASE 
         WHEN area IS NULL OR area = '' THEN 'GENERAL (sin area)'
         WHEN UPPER(area) LIKE '%SANATORIO%' THEN 'GENERAL (sanatorio)'
         WHEN UPPER(area) LIKE '%GENERAL%' THEN 'GENERAL (explícito)'
         ELSE 'SECTORAL'
       END as tipo_import
FROM fichadas_importaciones
ORDER BY fecha_importacion DESC
LIMIT 30;

-- Ver totales SIN ÁREA o con area genérica
SELECT 
  COUNT(*) as total_afectados,
  COUNT(*) FILTER (WHERE area IS NULL OR area = '') as sin_area,
  COUNT(*) FILTER (WHERE UPPER(area) LIKE '%SANATORIO%') as area_generica,
  COUNT(*) FILTER (WHERE area = 'SIN ASIGNAR') as sin_asignar
FROM fichadas_totales_mensuales;

-- Ver duplicados: colaboradores con más de 1 total por período
SELECT t.colaborador_id, c.nombre_completo, t.periodo_mes, t.periodo_anio, 
       COUNT(*) as duplicados,
       ARRAY_AGG(t.area) as areas,
       ARRAY_AGG(t.importacion_id) as importaciones
FROM fichadas_totales_mensuales t
JOIN fichadas_colaboradores c ON c.id = t.colaborador_id
GROUP BY t.colaborador_id, c.nombre_completo, t.periodo_mes, t.periodo_anio
HAVING COUNT(*) > 1
ORDER BY c.nombre_completo
LIMIT 50;

-- ─── PASO 2: ELIMINAR IMPORTS GENERALES QUE SOBREESCRIBIERON ─────
-- INSTRUCCIONES: 
--   1. Revisar el resultado del PASO 1
--   2. Identificar los IDs de imports generales que causaron el problema
--   3. Descomentar y reemplazar 'ID_DEL_IMPORT_GENERAL' con el ID real
/*
-- Borrar totales del import general
DELETE FROM fichadas_totales_mensuales 
WHERE importacion_id = 'ID_DEL_IMPORT_GENERAL';

-- Borrar registros del import general  
DELETE FROM fichadas_registros 
WHERE importacion_id = 'ID_DEL_IMPORT_GENERAL';

-- Borrar el import mismo
DELETE FROM fichadas_importaciones 
WHERE id = 'ID_DEL_IMPORT_GENERAL';
*/

-- ─── PASO 3: RESTAURAR ÁREAS DESDE COLABORADORES ────────────────
-- Si los totales quedaron sin área pero el colaborador SÍ tiene área asignada
/*
UPDATE fichadas_totales_mensuales t
SET area = c.area
FROM fichadas_colaboradores c
WHERE t.colaborador_id = c.id
  AND (t.area IS NULL OR t.area = '' OR UPPER(t.area) LIKE '%SANATORIO%')
  AND c.area IS NOT NULL 
  AND c.area != ''
  AND c.area != 'SIN ASIGNAR';
*/

-- ─── PASO 4: RESTAURAR ÁREAS DESDE IMPORTACIONES SECTORIALES ────
-- Si hay importaciones sectoriales previas, usar esas áreas
/*
UPDATE fichadas_totales_mensuales t
SET area = i.area
FROM fichadas_importaciones i
WHERE t.importacion_id = i.id
  AND (t.area IS NULL OR t.area = '' OR UPPER(t.area) LIKE '%SANATORIO%')
  AND i.area IS NOT NULL 
  AND i.area != ''
  AND UPPER(i.area) NOT LIKE '%SANATORIO%';
*/

-- ─── PASO 5: DEDUP TOTALES (si quedan duplicados por período) ────
-- Mantiene el total con MEJOR área (sectoral > genérico > vacío)
/*
DELETE FROM fichadas_totales_mensuales
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY colaborador_id, periodo_mes, periodo_anio
             ORDER BY 
               CASE 
                 WHEN area IS NOT NULL AND area != '' AND area != 'SIN ASIGNAR' 
                      AND UPPER(area) NOT LIKE '%SANATORIO%' THEN 1  -- Sectoral = best
                 WHEN area = 'SIN ASIGNAR' THEN 2
                 WHEN area IS NOT NULL AND area != '' THEN 3
                 ELSE 4  -- NULL/empty = worst
               END ASC
           ) as rn
    FROM fichadas_totales_mensuales
  ) ranked
  WHERE rn > 1
);
*/

-- ─── PASO 6: DEDUP REGISTROS DIARIOS ────────────────────────────
-- Si quedaron registros duplicados (mismo colaborador + misma fecha)
-- Mantiene el registro de la importación sectoral (no la general)
/*
DELETE FROM fichadas_registros
WHERE id IN (
  SELECT r.id FROM fichadas_registros r
  JOIN fichadas_importaciones i ON i.id = r.importacion_id
  WHERE r.id NOT IN (
    SELECT DISTINCT ON (colaborador_id, fecha) r2.id
    FROM fichadas_registros r2
    JOIN fichadas_importaciones i2 ON i2.id = r2.importacion_id
    WHERE r2.fecha >= '2026-03-01' AND r2.fecha <= '2026-04-30'
    ORDER BY colaborador_id, fecha,
      CASE 
        WHEN i2.area IS NOT NULL AND i2.area != '' 
             AND UPPER(i2.area) NOT LIKE '%SANATORIO%' THEN 1
        ELSE 2
      END ASC,
      r2.id ASC
  )
  AND r.fecha >= '2026-03-01' AND r.fecha <= '2026-04-30'
);
*/

-- ─── VERIFICACIÓN FINAL ─────────────────────────────────────────
-- Debe retornar 0 duplicados
SELECT t.colaborador_id, c.nombre_completo, t.periodo_mes, t.periodo_anio, 
       COUNT(*) as duplicados
FROM fichadas_totales_mensuales t
JOIN fichadas_colaboradores c ON c.id = t.colaborador_id
GROUP BY t.colaborador_id, c.nombre_completo, t.periodo_mes, t.periodo_anio
HAVING COUNT(*) > 1
LIMIT 10;

-- Debe retornar 0 sin área
SELECT COUNT(*) as sin_area 
FROM fichadas_totales_mensuales 
WHERE area IS NULL OR area = '';

-- Ver distribución de áreas (sanity check)
SELECT area, COUNT(*) as colaboradores
FROM fichadas_totales_mensuales
GROUP BY area
ORDER BY colaboradores DESC;
