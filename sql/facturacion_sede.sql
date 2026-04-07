-- =====================================================
-- FACTURACIÓN SEDE SANTA FE — v2
-- Fuente: [SALUS].[dbo].[PR_FACTURAS_QRY]
-- Datos deduplicados por idVisita (ROW_NUMBER)
-- =====================================================

-- Recrear tabla con el nuevo schema
DROP TABLE IF EXISTS facturacion_sede;

CREATE TABLE facturacion_sede (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_visita         TEXT,              -- idVisita de SALUS
  id_paciente       TEXT,              -- idPaciente
  paciente          TEXT,              -- Paciente_Nombre
  paciente_nhc      TEXT,              -- Paciente_NHC
  paciente_telefono TEXT,              -- Paciente_Telf1
  descripcion       TEXT,              -- Descripción de la práctica
  cantidad          INTEGER DEFAULT 1,
  total_importe     NUMERIC DEFAULT 0, -- ImporteTotal
  fecha             DATE NOT NULL,
  hora              TIME,
  turno             TEXT,              -- 'mañana' (7:30-16:30) / 'tarde' (12-21)
  familia           TEXT,              -- Ecografia, Facturación, Anatomía Patológica...
  servicio          TEXT,              -- ECOGRAFIAS - C.EXTERNOS, CITOLOGIA...
  forma_de_pago     TEXT,              -- Efectivo, Tarjeta Débito, San JuanTransferencia...
  responsable       TEXT,              -- Médico/profesional
  visita_tipo       TEXT,              -- Visita_TipoVisita — (ECO), (CX), (RX), etc.
  tarifa            TEXT,              -- 042 - PARTICULAR, 001 - PROVINCIA...
  usuario_factura   TEXT NOT NULL,     -- ⭐ La recepcionista
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries frecuentes del dashboard
CREATE INDEX idx_fact_sede_fecha ON facturacion_sede(fecha);
CREATE INDEX idx_fact_sede_usuario ON facturacion_sede(usuario_factura);
CREATE INDEX idx_fact_sede_fecha_usuario ON facturacion_sede(fecha, usuario_factura);
CREATE INDEX idx_fact_sede_familia ON facturacion_sede(familia);
CREATE INDEX idx_fact_sede_id_visita ON facturacion_sede(id_visita);
CREATE INDEX idx_fact_sede_forma_pago ON facturacion_sede(forma_de_pago);

-- RLS
ALTER TABLE facturacion_sede ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read facturacion_sede" ON facturacion_sede;
CREATE POLICY "Allow authenticated read facturacion_sede"
  ON facturacion_sede FOR SELECT TO authenticated USING (true);

-- Policy para insert/update/delete desde service_role (sync-server)
DROP POLICY IF EXISTS "Allow service role write facturacion_sede" ON facturacion_sede;
CREATE POLICY "Allow service role write facturacion_sede"
  ON facturacion_sede FOR ALL TO service_role USING (true) WITH CHECK (true);
