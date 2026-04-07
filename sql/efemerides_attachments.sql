-- ═══════════════════════════════════════════════════════════════
-- RRHH Efemérides — Tabla de Archivos Adjuntos
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de archivos adjuntos para efemérides
CREATE TABLE IF NOT EXISTS rrhh_efemerides_adjuntos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  efemeride_id UUID NOT NULL REFERENCES rrhh_efemerides(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índice por efeméride
CREATE INDEX IF NOT EXISTS idx_efemerides_adjuntos_efemeride
  ON rrhh_efemerides_adjuntos(efemeride_id);

-- 3. RLS
ALTER TABLE rrhh_efemerides_adjuntos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read efemerides adjuntos"
  ON rrhh_efemerides_adjuntos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert efemerides adjuntos"
  ON rrhh_efemerides_adjuntos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete efemerides adjuntos"
  ON rrhh_efemerides_adjuntos FOR DELETE
  TO authenticated
  USING (true);

-- 4. Crear bucket de storage (ejecutar desde Dashboard > Storage si no funciona por SQL)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('efemerides-attachments', 'efemerides-attachments', true)
-- ON CONFLICT DO NOTHING;
