-- =============================================
-- Métricas Visitas — Sede Santa Fe
-- =============================================

CREATE TABLE IF NOT EXISTS metricas_visitas_sf (
  id SERIAL PRIMARY KEY,
  id_visita BIGINT UNIQUE NOT NULL,
  fecha_visita DATE NOT NULL,
  mes INTEGER,
  hora_visita TIME,
  hora_numero INTEGER,            -- 0..23 para heatmap
  dia_semana INTEGER,             -- 0=Dom, 1=Lun ... 6=Sáb
  asistencia TEXT,
  paciente TEXT,
  grupo_agenda TEXT,
  especialidad TEXT,
  cliente TEXT,                    -- obra social
  responsable TEXT,                -- médico
  tipo_visita TEXT,
  centro TEXT DEFAULT 'SANTA FE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_metricas_sf_fecha ON metricas_visitas_sf(fecha_visita);
CREATE INDEX IF NOT EXISTS idx_metricas_sf_especialidad ON metricas_visitas_sf(especialidad);
CREATE INDEX IF NOT EXISTS idx_metricas_sf_cliente ON metricas_visitas_sf(cliente);
CREATE INDEX IF NOT EXISTS idx_metricas_sf_responsable ON metricas_visitas_sf(responsable);
CREATE INDEX IF NOT EXISTS idx_metricas_sf_hora ON metricas_visitas_sf(hora_numero);
CREATE INDEX IF NOT EXISTS idx_metricas_sf_dia ON metricas_visitas_sf(dia_semana);
CREATE INDEX IF NOT EXISTS idx_metricas_sf_tipo ON metricas_visitas_sf(tipo_visita);

-- RLS Policies (public access pattern matching existing project)
ALTER TABLE metricas_visitas_sf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read metricas_sf" ON metricas_visitas_sf
FOR SELECT USING (true);

CREATE POLICY "Allow public insert metricas_sf" ON metricas_visitas_sf
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update metricas_sf" ON metricas_visitas_sf
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete metricas_sf" ON metricas_visitas_sf
FOR DELETE USING (true);
