-- =====================================================
-- FACTURACIÓN SEDE SANTA FE
-- Tabla para almacenar datos de facturación sincronizados
-- desde SALUS via el sync-server de ADM-QUI
-- =====================================================

CREATE TABLE IF NOT EXISTS facturacion_sede (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha           DATE NOT NULL,
  hora            TIME,
  turno           TEXT,  -- 'mañana' (7-15) / 'tarde' (15+)
  paciente        TEXT,
  paciente_nif    TEXT,
  tarifa          TEXT,
  concepto        TEXT,
  familia         TEXT,  -- 'Facturación', 'Ecografía', etc.
  numero_factura  TEXT,
  cantidad        NUMERIC DEFAULT 1,
  importe_unitario NUMERIC DEFAULT 0,
  total_importe   NUMERIC DEFAULT 0,
  cobrado_linea   NUMERIC DEFAULT 0,
  responsable     TEXT,  -- Médico/profesional
  servicio        TEXT,  -- MAMOGRAFIAS - C EXTERNOS, etc.
  usuario_factura TEXT NOT NULL,  -- ⭐ La recepcionista
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Evitar duplicados exactos en cada sync
  UNIQUE(fecha, numero_factura, concepto, paciente_nif)
);

-- Índices para queries frecuentes del dashboard
CREATE INDEX IF NOT EXISTS idx_fact_sede_fecha 
  ON facturacion_sede(fecha);
CREATE INDEX IF NOT EXISTS idx_fact_sede_usuario 
  ON facturacion_sede(usuario_factura);
CREATE INDEX IF NOT EXISTS idx_fact_sede_fecha_usuario 
  ON facturacion_sede(fecha, usuario_factura);
CREATE INDEX IF NOT EXISTS idx_fact_sede_familia 
  ON facturacion_sede(familia);

-- RLS
ALTER TABLE facturacion_sede ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read facturacion_sede" ON facturacion_sede;
CREATE POLICY "Allow authenticated read facturacion_sede"
  ON facturacion_sede FOR SELECT TO authenticated USING (true);
