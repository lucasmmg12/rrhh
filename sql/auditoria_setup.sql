-- ══════════════════════════════════════════════════════════════════
-- MÓDULO: Auditoría en Terreno (Sede Santa Fe)
-- Tablas para el sistema de checklist de auditoría mobile-first
-- ══════════════════════════════════════════════════════════════════

-- ─── TABLA PRINCIPAL: AUDITORÍAS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS auditorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno TEXT NOT NULL CHECK (turno IN ('mañana', 'tarde')),
    sede TEXT NOT NULL DEFAULT 'Santa Fe',
    sector TEXT NOT NULL,
    responsable_presente TEXT,
    auditor_nombre TEXT NOT NULL,
    
    -- Resultados calculados (se guardan para consultas rápidas)
    total_puntos INTEGER DEFAULT 0,
    max_puntos INTEGER DEFAULT 24,
    porcentaje NUMERIC(5,2) DEFAULT 0,
    evaluacion TEXT CHECK (evaluacion IN ('bueno', 'regular', 'critico')),
    
    -- Hallazgos (Sección 4)
    no_conformidades TEXT,
    oportunidades_mejora TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditorias_fecha ON auditorias(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditorias_sector ON auditorias(sector);

-- ─── ITEMS DE CHECKLIST (Sección 2) ─────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auditoria_id UUID NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL CHECK (categoria IN ('presentacion', 'operativo', 'organizacion', 'infraestructura')),
    item_key TEXT NOT NULL,        -- ej: 'uniforme', 'sistemas', 'limpieza'
    item_label TEXT NOT NULL,      -- ej: 'Uniforme: Completo, limpio e identificado'
    puntuacion INTEGER NOT NULL CHECK (puntuacion IN (0, 1, 2)),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_items_auditoria ON auditoria_items(auditoria_id);

-- ─── PLANES DE ACCIÓN (Sección 5) ──────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria_planes_accion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auditoria_id UUID NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
    hallazgo TEXT NOT NULL,
    prioridad TEXT NOT NULL CHECK (prioridad IN ('alta', 'media', 'baja')),
    accion TEXT NOT NULL,
    responsable TEXT NOT NULL,
    fecha_limite DATE,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'resuelto', 'no_resuelto')),
    
    -- Para seguimiento: ¿qué auditoría lo actualizó?
    auditoria_seguimiento_id UUID REFERENCES auditorias(id) ON DELETE SET NULL,
    fecha_actualizacion TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planes_auditoria ON auditoria_planes_accion(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_planes_estado ON auditoria_planes_accion(estado);

-- ─── RLS POLICIES ───────────────────────────────────────────────
ALTER TABLE auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_planes_accion ENABLE ROW LEVEL SECURITY;

-- Public read/write (prototype — tighten later)
CREATE POLICY "auditorias_public_select" ON auditorias FOR SELECT USING (true);
CREATE POLICY "auditorias_public_insert" ON auditorias FOR INSERT WITH CHECK (true);
CREATE POLICY "auditorias_public_update" ON auditorias FOR UPDATE USING (true);
CREATE POLICY "auditorias_public_delete" ON auditorias FOR DELETE USING (true);

CREATE POLICY "items_public_select" ON auditoria_items FOR SELECT USING (true);
CREATE POLICY "items_public_insert" ON auditoria_items FOR INSERT WITH CHECK (true);
CREATE POLICY "items_public_update" ON auditoria_items FOR UPDATE USING (true);
CREATE POLICY "items_public_delete" ON auditoria_items FOR DELETE USING (true);

CREATE POLICY "planes_public_select" ON auditoria_planes_accion FOR SELECT USING (true);
CREATE POLICY "planes_public_insert" ON auditoria_planes_accion FOR INSERT WITH CHECK (true);
CREATE POLICY "planes_public_update" ON auditoria_planes_accion FOR UPDATE USING (true);
CREATE POLICY "planes_public_delete" ON auditoria_planes_accion FOR DELETE USING (true);
