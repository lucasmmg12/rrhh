-- ══════════════════════════════════════════════════════════════════
-- FIX: Registros duplicados y áreas vacías
-- Causa: PDF general cargado antes del Smart Merge, sobreescribió
--        totales y duplicó registros diarios
-- ══════════════════════════════════════════════════════════════════

-- ─── PASO 1: DIAGNÓSTICO ─────────────────────────────────────────
-- Ver todas las importaciones para el período afectado
SELECT id, nombre_archivo, area, periodo_mes, periodo_anio, 
       total_colaboradores, total_registros, fecha_importacion
FROM fichadas_importaciones
WHERE periodo_mes = 3 AND periodo_anio = 2026
ORDER BY fecha_importacion DESC;

-- Ver cuántos registros hay por importación  
SELECT i.id, i.nombre_archivo, i.area, 
       COUNT(r.id) as registros_count
FROM fichadas_importaciones i
LEFT JOIN fichadas_registros r ON r.importacion_id = i.id
WHERE i.periodo_mes = 3 AND i.periodo_anio = 2026
GROUP BY i.id, i.nombre_archivo, i.area
ORDER BY i.fecha_importacion DESC;

-- Ver duplicados: colaboradores con más de 1 registro por fecha
SELECT r.colaborador_id, c.nombre_completo, r.fecha, COUNT(*) as duplicados
FROM fichadas_registros r
JOIN fichadas_colaboradores c ON c.id = r.colaborador_id
WHERE r.fecha >= '2026-03-01' AND r.fecha <= '2026-03-31'
GROUP BY r.colaborador_id, c.nombre_completo, r.fecha
HAVING COUNT(*) > 1
ORDER BY c.nombre_completo, r.fecha
LIMIT 50;

-- Ver totales sin área
SELECT COUNT(*) as sin_area 
FROM fichadas_totales_mensuales 
WHERE (area IS NULL OR area = '') 
  AND periodo_mes = 3 AND periodo_anio = 2026;


-- ─── PASO 2: IDENTIFICAR IMPORT GENERAL ──────────────────────────
-- Reemplazá 'ID_DEL_IMPORT_GENERAL' con el ID real del paso 1
-- El import general es el que tiene area vacía/null o un area genérica
-- como "SANATORIO ARGENTINO" y el mayor total_colaboradores

-- Ejemplo: si el import general tiene id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- DO NOT RUN AUTOMATICALLY — revisar el ID primero
/*
-- Borrar registros del import general
DELETE FROM fichadas_registros 
WHERE importacion_id = 'ID_DEL_IMPORT_GENERAL';

-- Borrar totales del import general  
DELETE FROM fichadas_totales_mensuales 
WHERE importacion_id = 'ID_DEL_IMPORT_GENERAL';

-- Borrar el import mismo
DELETE FROM fichadas_importaciones 
WHERE id = 'ID_DEL_IMPORT_GENERAL';
*/


-- ─── PASO 3: DEDUP REGISTROS (si quedan duplicados) ──────────────
-- Mantiene solo el registro más antiguo de cada colaborador+fecha
-- (el que vino del import sectoral original)
/*
DELETE FROM fichadas_registros
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY colaborador_id, fecha 
             ORDER BY id ASC  -- keep the FIRST inserted (sectoral)
           ) as rn
    FROM fichadas_registros
    WHERE fecha >= '2026-03-01' AND fecha <= '2026-03-31'
  ) ranked
  WHERE rn > 1
);
*/


-- ─── PASO 4: RESTAURAR ÁREAS EN TOTALES ─────────────────────────
-- Actualiza el campo area en fichadas_totales_mensuales 
-- basándose en el area de la importación asociada
/*
UPDATE fichadas_totales_mensuales t
SET area = i.area
FROM fichadas_importaciones i
WHERE t.importacion_id = i.id
  AND t.periodo_mes = 3 
  AND t.periodo_anio = 2026
  AND i.area IS NOT NULL 
  AND i.area != '';
*/

-- Si aún quedan totales sin área, usar el area del colaborador
/*
UPDATE fichadas_totales_mensuales t
SET area = c.area
FROM fichadas_colaboradores c
WHERE t.colaborador_id = c.id
  AND t.periodo_mes = 3 
  AND t.periodo_anio = 2026
  AND (t.area IS NULL OR t.area = '')
  AND c.area IS NOT NULL 
  AND c.area != '';
*/


-- ─── VERIFICACIÓN FINAL ─────────────────────────────────────────
-- Debe retornar 0 duplicados
SELECT r.colaborador_id, c.nombre_completo, r.fecha, COUNT(*) as duplicados
FROM fichadas_registros r
JOIN fichadas_colaboradores c ON c.id = r.colaborador_id
WHERE r.fecha >= '2026-03-01' AND r.fecha <= '2026-03-31'
GROUP BY r.colaborador_id, c.nombre_completo, r.fecha
HAVING COUNT(*) > 1;

-- Debe retornar 0 sin área
SELECT COUNT(*) as sin_area 
FROM fichadas_totales_mensuales 
WHERE (area IS NULL OR area = '') 
  AND periodo_mes = 3 AND periodo_anio = 2026;
