-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Unificar sector DXI
-- DXI ahora incluye: Mamografía, Densitometría, Ecografías y RX
-- Los colaboradores que estaban en "MAMOGRAFÍA Y DENSITOGRAFÍA" 
-- pasan a sector "DXI"
-- ══════════════════════════════════════════════════════════════════

-- 1. Verificar estado actual
SELECT nombre_completo, area, sector
FROM fichadas_colaboradores
WHERE sector IN ('DXI', 'MAMOGRAFÍA Y DENSITOGRAFÍA', 'MAMOGRAFIA Y DENSITOGRAFIA')
   OR nombre_completo IN (
     'OROZCO LAURA MARIENELA', 'TORET ANA BELEN', 'GOMEZ MALVINA SOLEDAD',
     'TELLO CECILIA', 'ZARZUELO JULIETA MICAELA', 'OLIVA MARIA VERONICA',
     'PEREZ YANINA', 'DIAZ DANIELA', 'GORDILLO VEGA MONICA',
     'ESPEJO CRISTINA', 'RUARTE DAIANA', 'RUARTE MICAELA'
   )
ORDER BY nombre_completo;

-- 2. Unificar: Mamografía y Densitografía → DXI
UPDATE fichadas_colaboradores
SET sector = 'DXI',
    updated_at = NOW()
WHERE sector IN ('MAMOGRAFÍA Y DENSITOGRAFÍA', 'MAMOGRAFIA Y DENSITOGRAFIA');

-- 3. Asegurar que todos los colaboradores de DXI tengan el sector correcto
UPDATE fichadas_colaboradores
SET sector = 'DXI',
    updated_at = NOW()
WHERE nombre_completo IN (
  -- Técnicas de Radiología / Ecografías / RX
  'PEREZ YANINA', 'DIAZ DANIELA', 'GORDILLO VEGA MONICA',
  'ESPEJO CRISTINA', 'RUARTE DAIANA', 'RUARTE MICAELA',
  -- Mamografía y Densitometría
  'OROZCO LAURA MARIENELA', 'TORET ANA BELEN', 'GOMEZ MALVINA SOLEDAD',
  'TELLO CECILIA', 'ZARZUELO JULIETA MICAELA', 'OLIVA MARIA VERONICA'
)
AND (sector IS NULL OR sector != 'DXI');

-- 4. Verificación post-update
SELECT nombre_completo, area, sector
FROM fichadas_colaboradores
WHERE sector = 'DXI'
ORDER BY nombre_completo;
