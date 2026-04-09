-- ============================================
-- SCHEMA v2: Control de Horarios — Sede Santa Fe
-- Sanatorio Argentino SRL
-- Fecha: 2026-04-09
-- ============================================

-- 1. Tabla de sectores
CREATE TABLE IF NOT EXISTS ch_sectores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    color TEXT DEFAULT '#1E5FA6',
    orden INTEGER DEFAULT 0,
    sede TEXT DEFAULT 'SANTA FE',
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
    carga_horaria_semanal INTEGER DEFAULT 40,
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
CREATE INDEX IF NOT EXISTS idx_ch_sectores_sede ON ch_sectores(sede);

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
-- MIGRATION: Add 'sede' column if missing
-- ============================================
ALTER TABLE ch_sectores ADD COLUMN IF NOT EXISTS sede TEXT DEFAULT 'SANTA FE';

-- ============================================
-- SEED DATA: 7 Sectores de Sede Santa Fe
-- ============================================
INSERT INTO ch_sectores (nombre, descripcion, color, orden, sede) VALUES
  ('SECTOR 1', 'Sector operativo 1 — Sede Santa Fe', '#3B82F6', 1, 'SANTA FE'),
  ('SECTOR 2', 'Sector operativo 2 — Sede Santa Fe', '#8B5CF6', 2, 'SANTA FE'),
  ('CITOLOGÍA', 'Área de Citología — Sede Santa Fe', '#EC4899', 3, 'SANTA FE'),
  ('DXI', 'Diagnóstico por Imagen — Sede Santa Fe', '#F59E0B', 4, 'SANTA FE'),
  ('GUARDIAS DE SEGURIDAD', 'Personal de seguridad — Sede Santa Fe', '#10B981', 5, 'SANTA FE'),
  ('CHEQUEO Y PREVENIR', 'Área de Chequeo y Prevenir — Sede Santa Fe', '#06B6D4', 6, 'SANTA FE'),
  ('MAMOGRAFÍA Y DENSITOGRAFÍA', 'Mamografía y Densitografía — Sede Santa Fe', '#F472B6', 7, 'SANTA FE')
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  color = EXCLUDED.color,
  orden = EXCLUDED.orden,
  sede = EXCLUDED.sede;

-- ============================================
-- SEED DATA: Colaboradores por sector
-- ============================================

-- SECTOR 1
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Virginia Jacques', id FROM ch_sectores WHERE nombre = 'SECTOR 1'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Emilce Aparicio', id FROM ch_sectores WHERE nombre = 'SECTOR 1'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Malen Morales', id FROM ch_sectores WHERE nombre = 'SECTOR 1'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;

-- SECTOR 2
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Evelyn Atencio', id FROM ch_sectores WHERE nombre = 'SECTOR 2'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Julieta Quintero', id FROM ch_sectores WHERE nombre = 'SECTOR 2'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Érica Figueroa', id FROM ch_sectores WHERE nombre = 'SECTOR 2'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;

-- CITOLOGÍA
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Romina Vedia', id FROM ch_sectores WHERE nombre = 'CITOLOGÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Micaela Di Virgilio', id FROM ch_sectores WHERE nombre = 'CITOLOGÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Carla Mesina', id FROM ch_sectores WHERE nombre = 'CITOLOGÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;

-- DXI (Diagnóstico por Imagen)
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Yanina Pérez', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Daniela Diaz', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Monica Gordillo', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Cristina Espejo', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Daiana Ruarte', id FROM ch_sectores WHERE nombre = 'DXI'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;

-- GUARDIAS DE SEGURIDAD
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Julio Gómez', id FROM ch_sectores WHERE nombre = 'GUARDIAS DE SEGURIDAD'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'David Torres', id FROM ch_sectores WHERE nombre = 'GUARDIAS DE SEGURIDAD'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;

-- CHEQUEO Y PREVENIR
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Gisel Godoy', id FROM ch_sectores WHERE nombre = 'CHEQUEO Y PREVENIR'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;

-- MAMOGRAFÍA Y DENSITOGRAFÍA
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Marianela Orozco', id FROM ch_sectores WHERE nombre = 'MAMOGRAFÍA Y DENSITOGRAFÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Belen Toret', id FROM ch_sectores WHERE nombre = 'MAMOGRAFÍA Y DENSITOGRAFÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Malvina Gomez', id FROM ch_sectores WHERE nombre = 'MAMOGRAFÍA Y DENSITOGRAFÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Cecilia Tello', id FROM ch_sectores WHERE nombre = 'MAMOGRAFÍA Y DENSITOGRAFÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Julieta Zarzuelo', id FROM ch_sectores WHERE nombre = 'MAMOGRAFÍA Y DENSITOGRAFÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
INSERT INTO ch_colaboradores (nombre_completo, sector_id)
  SELECT 'Veronica Oliva', id FROM ch_sectores WHERE nombre = 'MAMOGRAFÍA Y DENSITOGRAFÍA'
ON CONFLICT (nombre_completo) DO UPDATE SET sector_id = EXCLUDED.sector_id;
