-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar campos de Operadora a metricas_visitas_sf
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Nuevas columnas
ALTER TABLE metricas_visitas_sf
  ADD COLUMN IF NOT EXISTS usuario_cita_raw TEXT,          -- cadena original del Excel
  ADD COLUMN IF NOT EXISTS operadora TEXT,                  -- nombre friendly de la operadora extraída
  ADD COLUMN IF NOT EXISTS sector_operadora TEXT;           -- sector asignado (SECTOR 1, SECTOR 2, CITOLOGÍA, DIAGNÓSTICO)

-- 2. Índices para analytics
CREATE INDEX IF NOT EXISTS idx_metricas_sf_operadora
  ON metricas_visitas_sf(operadora);

CREATE INDEX IF NOT EXISTS idx_metricas_sf_sector_op
  ON metricas_visitas_sf(sector_operadora);

-- 3. Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'metricas_visitas_sf'
ORDER BY ordinal_position;
