-- ============================================================
-- Formulario Público: Difusión Nuevos Prestadores
-- Setup: Tabla, RLS, Storage Bucket
-- ============================================================

-- 1. Tabla para almacenar los datos del formulario
CREATE TABLE IF NOT EXISTS nuevos_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo TEXT NOT NULL,
    servicio_especialidad TEXT NOT NULL,
    sedes TEXT[] NOT NULL,                -- Array de sedes seleccionadas (checkboxes)
    foto_url TEXT,                         -- URL pública de la foto en Storage
    comentarios TEXT,                      -- Preguntas y/o comentarios (opcional)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_prestadores_created_at ON nuevos_prestadores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestadores_especialidad ON nuevos_prestadores(servicio_especialidad);

-- 3. Row Level Security
ALTER TABLE nuevos_prestadores ENABLE ROW LEVEL SECURITY;

-- INSERT público (cualquier persona con el enlace puede enviar el formulario)
CREATE POLICY "Inserción pública de prestadores"
    ON nuevos_prestadores FOR INSERT
    WITH CHECK (true);

-- SELECT solo para usuarios autenticados (staff de RRHH)
CREATE POLICY "Lectura autenticada de prestadores"
    ON nuevos_prestadores FOR SELECT
    USING (auth.role() = 'authenticated');

-- UPDATE solo para usuarios autenticados
CREATE POLICY "Actualización autenticada de prestadores"
    ON nuevos_prestadores FOR UPDATE
    USING (auth.role() = 'authenticated');

-- DELETE solo para usuarios autenticados
CREATE POLICY "Eliminación autenticada de prestadores"
    ON nuevos_prestadores FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. Storage Bucket para fotos de prestadores
-- ============================================================
-- NOTA: Ejecutar esto desde el Dashboard de Supabase > Storage
-- o bien usar la API de administración:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('fotos-prestadores', 'fotos-prestadores', true);
--
-- Políticas del bucket (ejecutar en SQL Editor):

-- Permitir upload público (anon puede subir)
CREATE POLICY "Upload público fotos prestadores"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'fotos-prestadores');

-- Lectura pública de las fotos (para generar URLs)
CREATE POLICY "Lectura pública fotos prestadores"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'fotos-prestadores');
