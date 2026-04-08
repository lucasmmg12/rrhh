-- ============================================
-- SCHEMA: Control de Horarios
-- Sanatorio Argentino SRL
-- ============================================

-- 1. Tabla de sectores
CREATE TABLE IF NOT EXISTS ch_sectores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    color TEXT DEFAULT '#1E5FA6',
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de colaboradores del control horario
CREATE TABLE IF NOT EXISTS ch_colaboradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo TEXT NOT NULL,
    sector_id UUID REFERENCES ch_sectores(id) ON DELETE SET NULL,
    dni TEXT,
    legajo TEXT,
    telefono TEXT,
    email TEXT,
    cargo TEXT,
    turno_habitual TEXT, -- Mañana, Tarde, Noche, Rotativo
    carga_horaria_semanal INTEGER DEFAULT 40, -- horas semanales
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nombre_completo)
);

-- 3. Tabla de diagramas mensuales (planificación)
CREATE TABLE IF NOT EXISTS ch_diagramas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID REFERENCES ch_colaboradores(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    turno TEXT, -- M (Mañana), T (Tarde), N (Noche), F (Franco), L (Licencia)
    hora_inicio TIME,
    hora_fin TIME,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(colaborador_id, fecha)
);

-- 4. Tabla de fichadas (registros reales de ingreso/egreso)
CREATE TABLE IF NOT EXISTS ch_fichadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID REFERENCES ch_colaboradores(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_ingreso TIME,
    hora_egreso TIME,
    horas_trabajadas_min INTEGER DEFAULT 0,
    fuente TEXT DEFAULT 'manual', -- manual, reloj, importacion
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(colaborador_id, fecha)
);

-- 5. Tabla de novedades/incidencias
CREATE TABLE IF NOT EXISTS ch_novedades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID REFERENCES ch_colaboradores(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    tipo TEXT NOT NULL, -- llegada_tarde, salida_temprana, ausencia, hora_extra, justificada, injustificada
    minutos_diferencia INTEGER DEFAULT 0,
    descripcion TEXT,
    estado TEXT DEFAULT 'pendiente', -- pendiente, justificada, sancionada
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ch_colaboradores_sector ON ch_colaboradores(sector_id);
CREATE INDEX IF NOT EXISTS idx_ch_diagramas_colab ON ch_diagramas(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ch_diagramas_fecha ON ch_diagramas(fecha);
CREATE INDEX IF NOT EXISTS idx_ch_fichadas_colab ON ch_fichadas(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ch_fichadas_fecha ON ch_fichadas(fecha);
CREATE INDEX IF NOT EXISTS idx_ch_novedades_colab ON ch_novedades(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ch_novedades_fecha ON ch_novedades(fecha);

-- RLS
ALTER TABLE ch_sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_diagramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_fichadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_novedades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on ch_sectores" ON ch_sectores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ch_colaboradores" ON ch_colaboradores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ch_diagramas" ON ch_diagramas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ch_fichadas" ON ch_fichadas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ch_novedades" ON ch_novedades FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- SEED DATA: Sectores y Colaboradores iniciales
-- ============================================

-- Sectores
INSERT INTO ch_sectores (nombre, descripcion, color, orden) VALUES
  ('SECTOR 1', 'Sector operativo 1', '#3B82F6', 1),
  ('SECTOR 2', 'Sector operativo 2', '#8B5CF6', 2),
  ('CITOLOGÍA', 'Área de citología', '#EC4899', 3),
  ('DXI', 'Diagnóstico por Imagen', '#F59E0B', 4),
  ('GUARDIAS DE SEGURIDAD', 'Personal de seguridad', '#10B981', 5)
ON CONFLICT (nombre) DO NOTHING;

-- Colaboradores (vinculados a sus sectores)
-- SECTOR 1
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Virginia Jacques', id FROM ch_sectores WHERE nombre = 'SECTOR 1'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Emilce Aparicio', id FROM ch_sectores WHERE nombre = 'SECTOR 1'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Malen Morales', id FROM ch_sectores WHERE nombre = 'SECTOR 1'
ON CONFLICT (nombre_completo) DO NOTHING;

-- SECTOR 2
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Evelyn Atencio', id FROM ch_sectores WHERE nombre = 'SECTOR 2'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Julieta Quintero', id FROM ch_sectores WHERE nombre = 'SECTOR 2'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Érica Figueroa', id FROM ch_sectores WHERE nombre = 'SECTOR 2'
ON CONFLICT (nombre_completo) DO NOTHING;

-- CITOLOGÍA
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Romina Vedia', id FROM ch_sectores WHERE nombre = 'CITOLOGÍA'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Micaela Di Virgilio', id FROM ch_sectores WHERE nombre = 'CITOLOGÍA'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Carla Mesina', id FROM ch_sectores WHERE nombre = 'CITOLOGÍA'
ON CONFLICT (nombre_completo) DO NOTHING;

-- DIAGNÓSTICO
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Yanina Pérez', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Daniela Diaz', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Monica Gordillo', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Cristina Espejo', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Daiana Ruarte', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO NOTHING;

-- GUARDIAS DE SEGURIDAD
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Julio Gómez', id FROM ch_sectores WHERE nombre = 'GUARDIAS DE SEGURIDAD'
ON CONFLICT (nombre_completo) DO NOTHING;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'David Torres', id FROM ch_sectores WHERE nombre = 'GUARDIAS DE SEGURIDAD'
ON CONFLICT (nombre_completo) DO NOTHING;
