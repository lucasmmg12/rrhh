-- ═══════════════════════════════════════════════════════════════
-- RRHH Efemérides — Destinatarios (Colaboradores / Sectores)
-- Tabla many-to-many para asociar colaboradores a cada efeméride.
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de destinatarios
CREATE TABLE IF NOT EXISTS rrhh_efemerides_destinatarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  efemeride_id UUID NOT NULL REFERENCES rrhh_efemerides(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES fichadas_colaboradores(id) ON DELETE CASCADE,
  obsequio_entregado BOOLEAN DEFAULT false,    -- ¿Ya se entregó el obsequio?
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Evitar duplicados: un colaborador solo puede estar 1 vez por efeméride
  UNIQUE(efemeride_id, colaborador_id)
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_efemd_efemeride
  ON rrhh_efemerides_destinatarios(efemeride_id);
CREATE INDEX IF NOT EXISTS idx_efemd_colaborador
  ON rrhh_efemerides_destinatarios(colaborador_id);

-- 3. RLS
ALTER TABLE rrhh_efemerides_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete efem destinatarios"
  ON rrhh_efemerides_destinatarios FOR DELETE
  TO authenticated USING (true);
