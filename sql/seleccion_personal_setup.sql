-- ============================================================
-- Módulo: Selección de Personal por Área
-- Sanatorio Argentino — Sistema RRHH
-- ============================================================

CREATE TABLE IF NOT EXISTS seleccion_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area TEXT NOT NULL,
    puesto TEXT NOT NULL,
    fecha_solicitud DATE,
    fecha_aceptacion DATE,
    postulaciones INTEGER DEFAULT 0,
    perfiles_idoneos INTEGER DEFAULT 0,
    fuente_contratacion TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'Abierta', -- Abierta | Cubierta | Suspendida | Cancelada
    psicotecnicos INTEGER DEFAULT 0,
    fecha_ingreso DATE,
    situacion_3_meses TEXT DEFAULT '',      -- '' | Continúa | Baja
    motivo_busqueda TEXT DEFAULT '',        -- Reemplazo | Nuevo puesto | Cobertura temporal | Otro
    observaciones TEXT DEFAULT '',
    candidato_nombre TEXT DEFAULT '',
    sede TEXT DEFAULT 'Sede San Luis',
    is_example BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seleccion_fecha_solicitud ON seleccion_personal(fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_seleccion_area ON seleccion_personal(area);
CREATE INDEX IF NOT EXISTS idx_seleccion_estado ON seleccion_personal(estado);

ALTER TABLE seleccion_personal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso completo seleccion_personal"
    ON seleccion_personal FOR ALL
    USING (true)
    WITH CHECK (true);
