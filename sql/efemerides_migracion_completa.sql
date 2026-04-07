-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN INCREMENTAL: Efemérides — Adjuntos, Destinatarios, Columnas nuevas
-- Sanatorio Argentino — 2026-04-07
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  1. COLUMNAS FALTANTES en rrhh_efemerides                  │
-- └─────────────────────────────────────────────────────────────┘

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rrhh_efemerides' AND column_name = 'obsequio'
  ) THEN
    ALTER TABLE rrhh_efemerides ADD COLUMN obsequio BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rrhh_efemerides' AND column_name = 'notificar_whatsapp'
  ) THEN
    ALTER TABLE rrhh_efemerides ADD COLUMN notificar_whatsapp BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rrhh_efemerides' AND column_name = 'color'
  ) THEN
    ALTER TABLE rrhh_efemerides ADD COLUMN color TEXT DEFAULT '#0284c7';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rrhh_efemerides' AND column_name = 'icono'
  ) THEN
    ALTER TABLE rrhh_efemerides ADD COLUMN icono TEXT DEFAULT '📌';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rrhh_efemerides' AND column_name = 'genero_filtro'
  ) THEN
    ALTER TABLE rrhh_efemerides ADD COLUMN genero_filtro TEXT CHECK (genero_filtro IS NULL OR genero_filtro IN ('M', 'F'));
  END IF;
END $$;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  2. TABLA: rrhh_efemerides_adjuntos (archivos)             │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS rrhh_efemerides_adjuntos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  efemeride_id UUID NOT NULL REFERENCES rrhh_efemerides(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efemerides_adjuntos_efemeride
  ON rrhh_efemerides_adjuntos(efemeride_id);

ALTER TABLE rrhh_efemerides_adjuntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read efemerides adjuntos" ON rrhh_efemerides_adjuntos;
CREATE POLICY "Allow authenticated read efemerides adjuntos"
  ON rrhh_efemerides_adjuntos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert efemerides adjuntos" ON rrhh_efemerides_adjuntos;
CREATE POLICY "Allow authenticated insert efemerides adjuntos"
  ON rrhh_efemerides_adjuntos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated delete efemerides adjuntos" ON rrhh_efemerides_adjuntos;
CREATE POLICY "Allow authenticated delete efemerides adjuntos"
  ON rrhh_efemerides_adjuntos FOR DELETE TO authenticated USING (true);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  3. TABLA: rrhh_efemerides_destinatarios (personas/sector) │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS rrhh_efemerides_destinatarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  efemeride_id UUID NOT NULL REFERENCES rrhh_efemerides(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES fichadas_colaboradores(id) ON DELETE CASCADE,
  obsequio_entregado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(efemeride_id, colaborador_id)
);

CREATE INDEX IF NOT EXISTS idx_efemd_efemeride
  ON rrhh_efemerides_destinatarios(efemeride_id);
CREATE INDEX IF NOT EXISTS idx_efemd_colaborador
  ON rrhh_efemerides_destinatarios(colaborador_id);

ALTER TABLE rrhh_efemerides_destinatarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read efem destinatarios" ON rrhh_efemerides_destinatarios;
CREATE POLICY "Allow authenticated read efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert efem destinatarios" ON rrhh_efemerides_destinatarios;
CREATE POLICY "Allow authenticated insert efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update efem destinatarios" ON rrhh_efemerides_destinatarios;
CREATE POLICY "Allow authenticated update efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated delete efem destinatarios" ON rrhh_efemerides_destinatarios;
CREATE POLICY "Allow authenticated delete efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR DELETE TO authenticated USING (true);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  4. STORAGE BUCKET para adjuntos                           │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO storage.buckets (id, name, public)
VALUES ('efemerides-attachments', 'efemerides-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "efemerides_att_select" ON storage.objects;
CREATE POLICY "efemerides_att_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'efemerides-attachments');

DROP POLICY IF EXISTS "efemerides_att_insert" ON storage.objects;
CREATE POLICY "efemerides_att_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'efemerides-attachments');

DROP POLICY IF EXISTS "efemerides_att_delete" ON storage.objects;
CREATE POLICY "efemerides_att_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'efemerides-attachments');


-- ┌─────────────────────────────────────────────────────────────┐
-- │  5. EFEMÉRIDES COMPLETAS DEL AÑO — Sanatorio Argentino    │
-- │     Profesionales de la salud + institucionales + feriados  │
-- └─────────────────────────────────────────────────────────────┘

-- Crear constraint único temporal para evitar duplicados en el INSERT
-- (si ya existe una efeméride con mismo titulo+fecha, simplemente la saltea)
CREATE UNIQUE INDEX IF NOT EXISTS idx_efemerides_titulo_fecha
  ON rrhh_efemerides(titulo, fecha);

-- Solo INSERTA las que no existan — NO borra ni modifica nada existente
INSERT INTO rrhh_efemerides (titulo, fecha, tipo, recurrente, obsequio, color, icono, notificar_whatsapp) VALUES

  -- ═══ ENERO ═══
  ('Día del Médico Legista',                      '2026-01-10', 'dia_mundial', true, false, '#64748b', '⚖️', false),

  -- ═══ FEBRERO ═══
  ('Día Internacional de la Mujer Médica',        '2026-02-11', 'dia_mundial', true, false, '#ec4899', '👩‍⚕️', true),

  -- ═══ MARZO ═══
  ('Día del Administrativo',                      '2026-03-04', 'dia_mundial', true, true,  '#3b82f6', '🗂️', true),
  ('Día de la Mujer',                             '2026-03-08', 'dia_mundial', true, true,  '#ec4899', '💐', true),
  ('Día Mundial de la Tuberculosis',              '2026-03-24', 'dia_mundial', true, false, '#dc2626', '🫁', false),

  -- ═══ ABRIL ═══
  ('Día Mundial de la Salud',                     '2026-04-07', 'dia_mundial', true, false, '#10b981', '🏥', true),
  ('Día de Trabajadores de Mantenimiento',        '2026-04-13', 'dia_mundial', true, false, '#64748b', '🔧', true),
  ('Día del Kinesiólogo',                         '2026-04-13', 'dia_mundial', true, true,  '#06b6d4', '🦴', true),
  ('Día de la Higiene y Seguridad en el Trabajo', '2026-04-21', 'dia_mundial', true, false, '#f97316', '⚠️', true),

  -- ═══ MAYO ═══
  ('Día del Trabajador',                          '2026-05-01', 'feriado',     true, false, '#f59e0b', '💪', false),
  ('Día Mundial de la Higiene de Manos',          '2026-05-05', 'dia_mundial', true, false, '#0ea5e9', '🧼', false),
  ('Día Internacional de la Enfermería',          '2026-05-12', 'dia_mundial', true, true,  '#ec4899', '👩‍⚕️', true),
  ('Aniversario de Terapia Pediátrica',           '2026-05-29', 'institucional', true, false, '#7c3aed', '👶', true),
  ('Día Mundial Sin Tabaco',                      '2026-05-31', 'dia_mundial', true, false, '#64748b', '🚭', false),

  -- ═══ JUNIO ═══
  ('Día del Lic. en Bioimágenes',                 '2026-06-03', 'dia_mundial', true, true,  '#8b5cf6', '📡', true),
  ('Día del Profesional de Recursos Humanos',     '2026-06-07', 'dia_mundial', true, false, '#0ea5e9', '🤝', true),
  ('Día Mundial del Donante de Sangre',           '2026-06-14', 'dia_mundial', true, false, '#dc2626', '🩸', true),
  ('Día del Periodista',                          '2026-06-15', 'dia_mundial', true, false, '#64748b', '📰', false),

  -- ═══ JULIO ═══
  ('Día del Bioquímico',                          '2026-07-01', 'dia_mundial', true, false, '#8b5cf6', '🔬', true),
  ('Día del Facturador en Salud',                 '2026-07-03', 'dia_mundial', true, true,  '#0284c7', '🧾', true),
  ('Día del Bioingeniero',                        '2026-07-03', 'dia_mundial', true, false, '#06b6d4', '⚙️', false),
  ('Día del Cirujano Plástico',                   '2026-07-12', 'dia_mundial', true, false, '#7c3aed', '🩹', false),
  ('Día del Trabajador Social',                   '2026-07-19', 'dia_mundial', true, false, '#10b981', '🤲', false),
  ('Día del Amigo',                               '2026-07-20', 'dia_mundial', true, false, '#e11d48', '🫂', false),

  -- ═══ AGOSTO ═══
  ('Semana Mundial de la Lactancia Materna',      '2026-08-01', 'dia_mundial', true, false, '#f59e0b', '🤱', false),
  ('Día del Nutricionista',                       '2026-08-11', 'dia_mundial', true, true,  '#10b981', '🥗', true),
  ('Día del Instrumentador Quirúrgico',           '2026-08-19', 'dia_mundial', true, true,  '#14b8a6', '🏥', true),
  ('Día Nacional del Vacunador',                  '2026-08-26', 'dia_mundial', true, false, '#dc2626', '💉', true),
  ('Día del Licenciado en Enfermería',            '2026-08-29', 'dia_mundial', true, false, '#ec4899', '🩺', true),
  ('Día Nacional de la Obstetricia',              '2026-08-31', 'dia_mundial', true, false, '#ec4899', '🤰', true),

  -- ═══ SEPTIEMBRE ═══
  ('Día de la Secretaria',                        '2026-09-04', 'dia_mundial', true, true,  '#e11d48', '💐', true),
  ('Día Mundial de Prevención del Suicidio',      '2026-09-10', 'dia_mundial', true, false, '#f59e0b', '💛', false),
  ('Día del Programador Informático',             '2026-09-13', 'dia_mundial', true, true,  '#6366f1', '💻', true),
  ('Día del Estudiante',                          '2026-09-21', 'dia_mundial', true, false, '#f59e0b', '📚', false),
  ('Día de la Sanidad',                           '2026-09-21', 'dia_mundial', true, false, '#dc2626', '🏥', true),
  ('Día del Residente',                           '2026-09-23', 'institucional', true, true,  '#7c3aed', '🩻', true),
  ('Día del Farmacéutico',                        '2026-09-25', 'dia_mundial', true, true,  '#10b981', '💊', true),
  ('Día del Cirujano',                            '2026-09-26', 'dia_mundial', true, false, '#0284c7', '🔪', true),
  ('Día Mundial del Corazón',                     '2026-09-29', 'dia_mundial', true, false, '#dc2626', '❤️', false),
  ('Día del Profesional de Compras',              '2026-09-30', 'dia_mundial', true, false, '#64748b', '🛒', false),

  -- ═══ OCTUBRE ═══
  ('Día de los Auxiliares de Hotelería',          '2026-10-04', 'dia_mundial', true, true,  '#f97316', '🛏️', true),
  ('Día del Técnico de Laboratorio',              '2026-10-09', 'dia_mundial', true, false, '#8b5cf6', '🧪', true),
  ('Día Mundial de la Salud Mental',              '2026-10-10', 'dia_mundial', true, false, '#7c3aed', '🧠', false),
  ('Día del Psicólogo',                           '2026-10-13', 'dia_mundial', true, false, '#7c3aed', '🧠', true),
  ('Día del Anestesiólogo',                       '2026-10-16', 'dia_mundial', true, false, '#0284c7', '😷', true),
  ('Día del Auxiliar de Farmacia',                '2026-10-17', 'dia_mundial', true, true,  '#10b981', '💊', true),
  ('Día Mundial del Cáncer de Mama',              '2026-10-19', 'dia_mundial', true, false, '#ec4899', '🎗️', false),
  ('Día Internacional del Chef',                  '2026-10-20', 'dia_mundial', true, true,  '#f97316', '👨‍🍳', true),
  ('Día del Pediatra',                            '2026-10-20', 'dia_mundial', true, false, '#0ea5e9', '👶', true),

  -- ═══ NOVIEMBRE ═══
  ('Día del Camillero',                           '2026-11-05', 'dia_mundial', true, true,  '#64748b', '🏥', true),
  ('Día del Oncólogo',                            '2026-11-07', 'dia_mundial', true, false, '#dc2626', '🎗️', true),
  ('Día del Técnico Radiólogo',                   '2026-11-08', 'dia_mundial', true, true,  '#6366f1', '☢️', true),
  ('Día Mundial de la Calidad',                   '2026-11-10', 'institucional', true, false, '#f59e0b', '⭐', true),
  ('Día Mundial de la Diabetes',                  '2026-11-14', 'dia_mundial', true, false, '#0284c7', '💙', false),
  ('Día Mundial del Prematuro',                   '2026-11-17', 'dia_mundial', true, false, '#8b5cf6', '👶', true),
  ('Día de la Sanidad',                           '2026-11-21', 'dia_mundial', true, false, '#dc2626', '🏥', true),

  -- ═══ DICIEMBRE ═══
  ('Día Panamericano de la Farmacia',             '2026-12-01', 'dia_mundial', true, false, '#10b981', '💊', false),
  ('Día del Médico',                              '2026-12-03', 'dia_mundial', true, true,  '#0ea5e9', '🩺', true),
  ('Día de la Terapia Intensiva',                 '2026-12-06', 'dia_mundial', true, false, '#dc2626', '🫀', true),
  ('Día del Contador',                            '2026-12-17', 'dia_mundial', true, true,  '#3b82f6', '📊', true),
  ('Día del Técnico de Anestesia',                '2026-12-21', 'dia_mundial', true, true,  '#0284c7', '😷', true)
ON CONFLICT (titulo, fecha) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ MIGRACIÓN COMPLETA
--    • 5 columnas nuevas en rrhh_efemerides (obsequio, color, icono, etc.)
--    • Tabla rrhh_efemerides_adjuntos + RLS
--    • Tabla rrhh_efemerides_destinatarios + RLS
--    • Bucket efemerides-attachments + policies
--    • 60+ efemérides del año completo (Ene-Dic)
-- ═══════════════════════════════════════════════════════════════════════════════
