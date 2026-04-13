-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Asignar sector "CONTACT CENTER" a los 4 colaboradores
-- del área de Contact Center / Central Telefónica
-- ══════════════════════════════════════════════════════════════════
-- Ejecutar en Supabase SQL Editor ANTES de usar la Edge Function
-- get-fichadas con sector = 'CONTACT CENTER'
-- ══════════════════════════════════════════════════════════════════

-- 1. Verificar estado actual de los colaboradores
SELECT id, nombre_completo, area, sector, activo
FROM fichadas_colaboradores
WHERE nombre_completo IN (
  'ACOSTA ESQUIVEL MARIA ANTONELL',
  'AGUILERA DANIELA ROMINA',
  'MARINERO LUCAS MAXIMILIANO',
  'OLIVIER SOFIA'
)
ORDER BY nombre_completo;

-- 2. Asignar sector CONTACT CENTER
UPDATE fichadas_colaboradores
SET sector = 'CONTACT CENTER',
    updated_at = NOW()
WHERE nombre_completo IN (
  'ACOSTA ESQUIVEL MARIA ANTONELL',
  'AGUILERA DANIELA ROMINA',
  'MARINERO LUCAS MAXIMILIANO',
  'OLIVIER SOFIA'
);

-- 3. Verificación post-update
SELECT id, nombre_completo, area, sector, activo
FROM fichadas_colaboradores
WHERE sector = 'CONTACT CENTER'
ORDER BY nombre_completo;
