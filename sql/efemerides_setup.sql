-- ═══════════════════════════════════════════════════════════════
-- RRHH Efemérides — Setup de tablas
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla principal de efemérides
CREATE TABLE IF NOT EXISTS rrhh_efemerides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,                        -- Fecha completa (YYYY-MM-DD)
  tipo TEXT NOT NULL CHECK (tipo IN (
    'cumpleaños',                              -- Cumpleaños de colaborador
    'dia_mundial',                             -- Día mundial / internacional
    'feriado',                                 -- Feriado nacional
    'institucional',                           -- Evento del sanatorio
    'otro'                                     -- Otros
  )),
  recurrente BOOLEAN DEFAULT false,           -- ¿Se repite cada año?
  colaborador_id UUID REFERENCES fichadas_colaboradores(id) ON DELETE SET NULL,
  sector TEXT,                                 -- Sector afectado (null = todos)
  genero_filtro TEXT CHECK (genero_filtro IN ('M', 'F', NULL)),  -- Para obsequios
  color TEXT DEFAULT '#0284c7',               -- Color visual en el calendario
  icono TEXT DEFAULT '🎂',                    -- Emoji representativo
  notificar_whatsapp BOOLEAN DEFAULT false,   -- ¿Enviar notificación WA?
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_efemerides_fecha ON rrhh_efemerides(fecha);
CREATE INDEX IF NOT EXISTS idx_efemerides_tipo ON rrhh_efemerides(tipo);
CREATE INDEX IF NOT EXISTS idx_efemerides_colaborador ON rrhh_efemerides(colaborador_id);

-- 2. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_efemerides_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_efemerides_updated ON rrhh_efemerides;
CREATE TRIGGER trg_efemerides_updated
  BEFORE UPDATE ON rrhh_efemerides
  FOR EACH ROW
  EXECUTE FUNCTION update_efemerides_timestamp();

-- 3. RLS (Row Level Security)
ALTER TABLE rrhh_efemerides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read efemerides"
  ON rrhh_efemerides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert efemerides"
  ON rrhh_efemerides FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update efemerides"
  ON rrhh_efemerides FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete efemerides"
  ON rrhh_efemerides FOR DELETE
  TO authenticated
  USING (true);

-- 4. Agregar campo genero a fichadas_colaboradores (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichadas_colaboradores' AND column_name = 'genero'
  ) THEN
    ALTER TABLE fichadas_colaboradores ADD COLUMN genero TEXT CHECK (genero IN ('M', 'F'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fichadas_colaboradores' AND column_name = 'fecha_nacimiento'
  ) THEN
    ALTER TABLE fichadas_colaboradores ADD COLUMN fecha_nacimiento DATE;
  END IF;
END $$;

-- 5. Datos semilla: Días mundiales de salud (recurrentes)
INSERT INTO rrhh_efemerides (titulo, descripcion, fecha, tipo, recurrente, color, icono, notificar_whatsapp) VALUES
  ('Día Mundial de la Salud', 'Promovido por la OMS', '2026-04-07', 'dia_mundial', true, '#dc2626', '🏥', true),
  ('Día Internacional de la Enfermería', 'Florence Nightingale', '2026-05-12', 'dia_mundial', true, '#ec4899', '👩‍⚕️', true),
  ('Día del Médico', 'Argentina', '2026-12-03', 'dia_mundial', true, '#0ea5e9', '🩺', true),
  ('Día del Trabajador', '1° de Mayo', '2026-05-01', 'feriado', true, '#f59e0b', '💪', false),
  ('Día de la Madre', 'Argentina', '2026-10-18', 'dia_mundial', true, '#e11d48', '💐', true),
  ('Día del Padre', 'Argentina', '2026-06-21', 'dia_mundial', true, '#3b82f6', '👔', true),
  ('Día del Bioquímico', 'Argentina', '2026-06-15', 'dia_mundial', true, '#8b5cf6', '🔬', true),
  ('Día del Kinesiólogo', 'Argentina', '2026-04-13', 'dia_mundial', true, '#06b6d4', '🦴', true),
  ('Día del Instrumentador Quirúrgico', 'Argentina', '2026-09-28', 'dia_mundial', true, '#14b8a6', '🏥', true),
  ('Día de la Seguridad e Higiene en el Trabajo', 'Argentina', '2026-04-21', 'dia_mundial', true, '#f97316', '⚠️', true)
ON CONFLICT DO NOTHING;
