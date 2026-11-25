-- ============================================================
-- Módulo: Padrón Histórico y Línea de Tiempo de Médicos (SALUS)
-- Sanatorio Argentino — Sistema RRHH
-- ============================================================

CREATE TABLE IF NOT EXISTS padron_medicos_salus (
    id_personal INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    nombre_abrev TEXT DEFAULT '',
    matricula TEXT DEFAULT '',
    nif TEXT DEFAULT '',
    dni TEXT DEFAULT '',
    cuil TEXT DEFAULT '',
    razon_social TEXT DEFAULT '',
    direccion TEXT DEFAULT '',
    calle TEXT DEFAULT '',
    cp TEXT DEFAULT '',
    localidad TEXT DEFAULT '',
    seguro TEXT DEFAULT '',
    seguro_vencimiento DATE,
    nro_sss TEXT DEFAULT '',
    foto_url TEXT DEFAULT '',
    prestador_comentarios TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    email TEXT DEFAULT '',
    titulo TEXT DEFAULT '',
    fecha_nacimiento DATE,
    activo_salus BOOLEAN DEFAULT true,
    es_generico BOOLEAN DEFAULT false,
    fecha_alta_salus DATE,
    fecha_baja_salus DATE,
    total_atenciones INTEGER DEFAULT 0,
    pacientes_unicos INTEGER DEFAULT 0,
    primera_atencion DATE,
    ultima_atencion DATE,
    dias_sin_atender INTEGER DEFAULT 0,
    estado_actividad TEXT DEFAULT 'Inactivo', -- Activo | Baja Frecuencia | Inactivo
    atenciones_30d INTEGER DEFAULT 0,
    atenciones_90d INTEGER DEFAULT 0,
    atenciones_180d INTEGER DEFAULT 0,
    atenciones_365d INTEGER DEFAULT 0,
    meses_activos INTEGER DEFAULT 0,
    dias_atendidos INTEGER DEFAULT 0,
    promedio_por_mes_activo INTEGER DEFAULT 0,
    promedio_por_dia_atendido NUMERIC(8,1) DEFAULT 0,
    especialidad_principal TEXT DEFAULT 'Sin especificar',
    especialidades JSONB DEFAULT '[]'::jsonb,
    especialidades_secundarias JSONB DEFAULT '[]'::jsonb,
    es_solo_guardia BOOLEAN DEFAULT false,
    modalidad_atencion TEXT DEFAULT 'Consultorio / Programado',
    atenciones_guardia INTEGER DEFAULT 0,
    pct_guardia NUMERIC(5,1) DEFAULT 0,
    agendas_guardia JSONB DEFAULT '[]'::jsonb,
    codigo_alternativo TEXT DEFAULT '',
    profesion_salus TEXT DEFAULT '',
    es_jefe_servicio BOOLEAN DEFAULT false,
    servicios_salus JSONB DEFAULT '[]'::jsonb,
    actividades_salus JSONB DEFAULT '{}'::jsonb,
    liquida_salus BOOLEAN DEFAULT false,
    ultima_liquidacion DATE,
    total_liquidaciones INTEGER DEFAULT 0,
    pct_gasto_liquidacion NUMERIC(5,2) DEFAULT 0,
    alquila_consultorio BOOLEAN DEFAULT false,
    alquileres_salus JSONB DEFAULT '[]'::jsonb,
    convenios_habilitados_count INTEGER DEFAULT 0,
    top_atenciones JSONB DEFAULT '[]'::jsonb,
    top_obras_sociales JSONB DEFAULT '[]'::jsonb,
    sedes JSONB DEFAULT '[]'::jsonb,
    historial_anual JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_padron_salus_estado ON padron_medicos_salus(estado_actividad);
CREATE INDEX IF NOT EXISTS idx_padron_salus_ultima ON padron_medicos_salus(ultima_atencion DESC);
CREATE INDEX IF NOT EXISTS idx_padron_salus_especialidad ON padron_medicos_salus(especialidad_principal);
CREATE INDEX IF NOT EXISTS idx_padron_salus_total ON padron_medicos_salus(total_atenciones DESC);

ALTER TABLE padron_medicos_salus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura y escritura padron_medicos_salus"
    ON padron_medicos_salus FOR ALL
    USING (true)
    WITH CHECK (true);
