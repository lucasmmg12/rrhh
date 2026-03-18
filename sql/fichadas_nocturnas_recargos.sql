-- ==========================================
-- MIGRACIÓN: Horas nocturnas + Recargos
-- ==========================================

-- 1. Agregar columnas a fichadas_registros (diario)
ALTER TABLE fichadas_registros ADD COLUMN IF NOT EXISTS horas_nocturnas_min INTEGER DEFAULT 0;
ALTER TABLE fichadas_registros ADD COLUMN IF NOT EXISTS es_turno_noche BOOLEAN DEFAULT false;
ALTER TABLE fichadas_registros ADD COLUMN IF NOT EXISTS es_recargo BOOLEAN DEFAULT false;
ALTER TABLE fichadas_registros ADD COLUMN IF NOT EXISTS turno_noche_merge BOOLEAN DEFAULT false;

-- 2. Agregar columnas a fichadas_totales_mensuales
ALTER TABLE fichadas_totales_mensuales ADD COLUMN IF NOT EXISTS total_horas_nocturnas_min INTEGER DEFAULT 0;
ALTER TABLE fichadas_totales_mensuales ADD COLUMN IF NOT EXISTS dias_noche INTEGER DEFAULT 0;
ALTER TABLE fichadas_totales_mensuales ADD COLUMN IF NOT EXISTS recargos INTEGER DEFAULT 0;
ALTER TABLE fichadas_totales_mensuales ADD COLUMN IF NOT EXISTS total_horas_recargo_min INTEGER DEFAULT 0;

-- 3. Tabla de configuración de franjas nocturnas por área
CREATE TABLE IF NOT EXISTS fichadas_config_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_pattern TEXT NOT NULL,
    noche_inicio INTEGER NOT NULL DEFAULT 23,  -- hora de inicio del turno noche (23 = 23:00)
    noche_fin INTEGER NOT NULL DEFAULT 7,      -- hora de fin del turno noche (7 = 07:00)
    recargo_min_horas INTEGER NOT NULL DEFAULT 14,  -- mínimo de horas para considerar recargo
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(area_pattern)
);

-- RLS
ALTER TABLE fichadas_config_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on fichadas_config_areas" ON fichadas_config_areas FOR ALL USING (true) WITH CHECK (true);

-- 4. Insertar configuraciones por defecto
INSERT INTO fichadas_config_areas (area_pattern, noche_inicio, noche_fin, recargo_min_horas, descripcion)
VALUES 
  ('ENFERMERIA', 21, 7, 14, 'Enfermería: noche de 21 a 07, recargo >= 14h'),
  ('NEONATOLOGIA', 21, 7, 14, 'Neonatología (enfermería): noche de 21 a 07'),
  ('UTI', 21, 7, 14, 'UTI (enfermería): noche de 21 a 07'),
  ('GUARDIA', 21, 7, 14, 'Guardia (enfermería): noche de 21 a 07'),
  ('RECEPCION', 23, 7, 14, 'Recepción: noche de 23 a 07'),
  ('HOTELERIA', 23, 7, 14, 'Hotelería: noche de 23 a 07'),
  ('AUXILIAR', 23, 7, 14, 'Auxiliares: noche de 23 a 07')
ON CONFLICT (area_pattern) DO NOTHING;
