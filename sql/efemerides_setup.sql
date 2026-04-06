-- ═══════════════════════════════════════════════════════════════
-- RRHH Efemérides — Setup de tablas
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

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
  obsequio BOOLEAN DEFAULT false,             -- ¿RRHH entrega obsequio?
  colaborador_id UUID REFERENCES fichadas_colaboradores(id) ON DELETE SET NULL,
  sector TEXT,                                 -- Sector afectado (null = todos)
  genero_filtro TEXT CHECK (genero_filtro IS NULL OR genero_filtro IN ('M', 'F')),
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

-- 5. Datos semilla: Calendario de Efemérides RRHH (lista de Romina Marún)
-- Fechas adaptadas a 2026, recurrentes cada año
INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) VALUES
  -- ENERO
  -- (20/1 sin título especificado en la lista original)

  -- MARZO
  ('Día del Administrativo',                    '2026-03-04', 'dia_mundial', true, true,  '#3b82f6', '🗂️', true),

  -- ABRIL
  ('Día de Trabajadores de Mantenimiento',      '2026-04-13', 'dia_mundial', true, false, '#64748b', '🔧', true),
  ('Día del Kinesiólogo',                       '2026-04-21', 'dia_mundial', true, true,  '#06b6d4', '🦴', true),

  -- MAYO
  ('Día de la Higiene y Seguridad en el Trabajo','2026-05-01', 'dia_mundial', true, false, '#f97316', '⚠️', true),
  ('Día del Trabajador',                        '2026-05-12', 'institucional', true, false, '#f59e0b', '💪', false),
  ('Día Internacional de la Enfermería',         '2026-05-27', 'dia_mundial', true, true,  '#ec4899', '👩‍⚕️', true),
  ('Aniversario de Terapia Pediátrica',         '2026-05-29', 'institucional', true, false, '#7c3aed', '👶', true),

  -- JUNIO
  ('Día del Lic. en Bioimágenes',               '2026-06-03', 'dia_mundial', true, true,  '#8b5cf6', '📡', true),
  ('Día del Profesional de Recursos Humanos',   '2026-06-07', 'dia_mundial', true, false, '#0ea5e9', '🤝', true),
  ('Día del Periodista',                        '2026-06-15', 'dia_mundial', true, false, '#64748b', '📰', false),

  -- JULIO
  ('Día del Bioquímico',                        '2026-07-01', 'dia_mundial', true, false, '#8b5cf6', '🔬', true),
  ('Día del Facturador en Salud',               '2026-07-03', 'dia_mundial', true, true,  '#0284c7', '🧾', true),
  ('Día del Bioingeniero',                      '2026-07-03', 'dia_mundial', true, false, '#06b6d4', '⚙️', false),
  ('Día del Amigo',                             '2026-07-20', 'dia_mundial', true, false, '#e11d48', '🫂', false),

  -- AGOSTO
  ('Día del Nutricionista',                     '2026-08-11', 'dia_mundial', true, true,  '#10b981', '🥗', true),
  ('Día Nacional del Vacunador',                '2026-08-26', 'dia_mundial', true, false, '#dc2626', '💉', true),
  ('Día del Licenciado en Enfermería',          '2026-08-29', 'dia_mundial', true, false, '#ec4899', '🩺', true),

  -- SEPTIEMBRE
  ('Día de la Secretaria',                      '2026-09-04', 'dia_mundial', true, true,  '#e11d48', '💐', true),
  ('Día del Programador Informático',           '2026-09-13', 'dia_mundial', true, true,  '#6366f1', '💻', true),
  ('Día del Instrumentador Quirúrgico',         '2026-09-19', 'dia_mundial', true, true,  '#14b8a6', '🏥', true),
  ('Día del Estudiante',                        '2026-09-21', 'dia_mundial', true, false, '#f59e0b', '📚', false),
  ('Día del Residente',                         '2026-09-23', 'institucional', true, true,  '#7c3aed', '🩻', true),
  ('Día del Farmacéutico',                      '2026-09-25', 'dia_mundial', true, true,  '#10b981', '💊', true),
  ('Día del Cirujano',                          '2026-09-26', 'dia_mundial', true, false, '#0284c7', '🔪', true),
  ('Día del Profesional de Compras',            '2026-09-30', 'dia_mundial', true, false, '#64748b', '🛒', false),

  -- OCTUBRE
  ('Día de los Auxiliares de Hotelería',        '2026-10-04', 'dia_mundial', true, true,  '#f97316', '🛏️', true),
  ('Día del Técnico de Laboratorio',            '2026-10-09', 'dia_mundial', true, false, '#8b5cf6', '🧪', true),
  ('Día del Psicólogo',                         '2026-10-13', 'dia_mundial', true, false, '#7c3aed', '🧠', true),
  ('Día del Anestesiólogo',                     '2026-10-16', 'dia_mundial', true, false, '#0284c7', '😷', true),
  ('Día del Auxiliar de Farmacia',              '2026-10-17', 'dia_mundial', true, true,  '#10b981', '💊', true),
  ('Día Internacional del Chef',                '2026-10-20', 'dia_mundial', true, true,  '#f97316', '👨‍🍳', true),
  ('Día del Pediatra',                          '2026-10-20', 'dia_mundial', true, false, '#0ea5e9', '👶', true),

  -- NOVIEMBRE
  ('Día del Camillero',                         '2026-11-05', 'dia_mundial', true, true,  '#64748b', '🏥', true),
  ('Día del Técnico Radiólogo',                 '2026-11-08', 'dia_mundial', true, true,  '#6366f1', '☢️', true),
  ('Día Mundial de la Calidad',                 '2026-11-10', 'institucional', true, false, '#f59e0b', '⭐', true),
  ('Día de la Sanidad',                         '2026-11-21', 'dia_mundial', true, false, '#dc2626', '🏥', true),

  -- DICIEMBRE
  ('Día del Médico',                            '2026-12-03', 'dia_mundial', true, true,  '#0ea5e9', '🩺', true),
  ('Día del Contador',                          '2026-12-17', 'dia_mundial', true, true,  '#3b82f6', '📊', true),
  ('Día del Técnico de Anestesia',              '2026-12-21', 'dia_mundial', true, true,  '#0284c7', '😷', true)
ON CONFLICT DO NOTHING;
