-- Add auxiliar_hoteleria column to auditorias table
-- This tracks which housekeeping auxiliary was present during the audit
ALTER TABLE auditorias 
  ADD COLUMN IF NOT EXISTS auxiliar_hoteleria TEXT DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN auditorias.auxiliar_hoteleria IS 'Auxiliar de hotelería presente durante la ronda de auditoría (rotan entre sectores)';
