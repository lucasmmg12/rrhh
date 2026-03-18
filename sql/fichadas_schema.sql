-- ============================================
-- SCHEMA: Sistema de Control de Fichadas
-- Sanatorio Argentino SRL
-- ============================================

-- 1. Tabla de importaciones (cada PDF subido)
CREATE TABLE IF NOT EXISTS fichadas_importaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_archivo TEXT NOT NULL,
    area TEXT,              -- Ej: NEONATOLOGIA, ENFERMERIA
    periodo_mes INTEGER,    -- 1-12
    periodo_anio INTEGER,   -- 2026
    fecha_importacion TIMESTAMPTZ DEFAULT NOW(),
    total_colaboradores INTEGER DEFAULT 0,
    total_registros INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Tabla de colaboradores (maestro)
CREATE TABLE IF NOT EXISTS fichadas_colaboradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo TEXT NOT NULL,
    dni TEXT,
    tarjeta TEXT,
    area TEXT,
    sector TEXT,
    carga_horaria_default TEXT DEFAULT '07:00', -- HH:MM
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nombre_completo)
);

-- 3. Tabla de registros diarios de fichadas
CREATE TABLE IF NOT EXISTS fichadas_registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    importacion_id UUID REFERENCES fichadas_importaciones(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES fichadas_colaboradores(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    fichada_entrada TIME,
    fichada_salida TIME,
    -- Horas calculadas (en minutos para precisión)
    horas_trabajadas_min INTEGER DEFAULT 0,
    horas_redondeadas_min INTEGER DEFAULT 0,
    horas_cumplidas_min INTEGER DEFAULT 0,
    horas_adicionales_min INTEGER DEFAULT 0,
    horas_intermedias_min INTEGER DEFAULT 0,
    hora_extra_min INTEGER DEFAULT 0,
    horas_registradas_min INTEGER DEFAULT 0,
    -- Marcadores
    tarde BOOLEAN DEFAULT false,
    fuera_de_hora BOOLEAN DEFAULT false,
    incompleta BOOLEAN DEFAULT false,
    excepciones TEXT,
    -- Horario asignado
    horario_50 TEXT,
    horario_100 TEXT,
    horario_entrada TIME,
    horario_salida TIME,
    carga_horaria TEXT DEFAULT '00:00',
    -- Metadata
    datos_raw JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de totales mensuales por colaborador
CREATE TABLE IF NOT EXISTS fichadas_totales_mensuales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    importacion_id UUID REFERENCES fichadas_importaciones(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES fichadas_colaboradores(id) ON DELETE CASCADE,
    periodo_mes INTEGER NOT NULL,
    periodo_anio INTEGER NOT NULL,
    area TEXT,
    -- Totales en minutos
    total_horas_trabajadas_min INTEGER DEFAULT 0,
    total_horas_redondeadas_min INTEGER DEFAULT 0,
    total_horas_cumplidas_min INTEGER DEFAULT 0,
    total_horas_adicionales_min INTEGER DEFAULT 0,
    total_hora_extra_min INTEGER DEFAULT 0,
    total_horas_registradas_min INTEGER DEFAULT 0,
    -- Contadores
    dias_trabajados INTEGER DEFAULT 0,
    dias_tarde INTEGER DEFAULT 0,
    dias_fuera_hora INTEGER DEFAULT 0,
    dias_incompletos INTEGER DEFAULT 0,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(colaborador_id, periodo_mes, periodo_anio)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fichadas_registros_colaborador ON fichadas_registros(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_fichadas_registros_fecha ON fichadas_registros(fecha);
CREATE INDEX IF NOT EXISTS idx_fichadas_registros_importacion ON fichadas_registros(importacion_id);
CREATE INDEX IF NOT EXISTS idx_fichadas_totales_periodo ON fichadas_totales_mensuales(periodo_mes, periodo_anio);
CREATE INDEX IF NOT EXISTS idx_fichadas_totales_colaborador ON fichadas_totales_mensuales(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_fichadas_colaboradores_area ON fichadas_colaboradores(area);
CREATE INDEX IF NOT EXISTS idx_fichadas_colaboradores_sector ON fichadas_colaboradores(sector);

-- RLS Policies (permisivas para prototipo)
ALTER TABLE fichadas_importaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichadas_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichadas_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichadas_totales_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on fichadas_importaciones" ON fichadas_importaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fichadas_colaboradores" ON fichadas_colaboradores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fichadas_registros" ON fichadas_registros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fichadas_totales_mensuales" ON fichadas_totales_mensuales FOR ALL USING (true) WITH CHECK (true);
