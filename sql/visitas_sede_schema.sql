-- ═══════════════════════════════════════════════════════════════
-- VISITAS SEDE (VLISE_Visitas) — Analytics de consultas médicas
-- Fuente: SALUS SQL Server → VLISE_Visitas
-- Centro: SANTA FE | Asistencia: Presente
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS visitas_sede (
    id              BIGSERIAL PRIMARY KEY,
    id_visita       TEXT,
    fecha           DATE NOT NULL,
    id_paciente     TEXT,
    paciente        TEXT,
    cliente         TEXT,            -- Obra social
    responsable     TEXT,            -- Médico responsable
    tipo_visita     TEXT,            -- Tipo de visita
    especialidad    TEXT,            -- Visita_Especialidad
    usuario_creacion TEXT NOT NULL,  -- Usuario Creación Nombre (colaborador)
    centro          TEXT DEFAULT 'SANTA FE',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries analíticas
CREATE INDEX IF NOT EXISTS idx_visitas_sede_fecha ON visitas_sede(fecha);
CREATE INDEX IF NOT EXISTS idx_visitas_sede_usuario ON visitas_sede(usuario_creacion);
CREATE INDEX IF NOT EXISTS idx_visitas_sede_especialidad ON visitas_sede(especialidad);
CREATE INDEX IF NOT EXISTS idx_visitas_sede_tipo ON visitas_sede(tipo_visita);
CREATE INDEX IF NOT EXISTS idx_visitas_sede_fecha_usuario ON visitas_sede(fecha, usuario_creacion);

-- RLS
ALTER TABLE visitas_sede ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitas_sede_read" ON visitas_sede
    FOR SELECT USING (true);

CREATE POLICY "visitas_sede_service_write" ON visitas_sede
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE visitas_sede IS 'Datos de consultas/visitas médicas sede Santa Fe, sincronizados desde VLISE_Visitas (SALUS)';
