-- ═══════════════════════════════════════════════════════════
-- STORAGE: Diagramas de Control Horario (PDF/Imagen)
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Crear bucket de storage para diagramas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'diagramas',
  'diagramas',
  true,
  10485760,  -- 10MB max
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla de metadatos de diagramas subidos
CREATE TABLE IF NOT EXISTS public.ch_diagramas_archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  periodo_mes INTEGER NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_anio INTEGER NOT NULL CHECK (periodo_anio >= 2020),
  nombre_archivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tipo_archivo TEXT NOT NULL DEFAULT 'application/pdf',
  tamano_bytes BIGINT DEFAULT 0,
  observaciones TEXT,
  subido_por TEXT DEFAULT 'sistema',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda rápida por sector+periodo
CREATE INDEX IF NOT EXISTS idx_ch_diagramas_sector_periodo
ON public.ch_diagramas_archivos (sector, periodo_anio, periodo_mes);

-- 3. RLS Policies
ALTER TABLE public.ch_diagramas_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de diagramas"
ON public.ch_diagramas_archivos FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Inserción autenticada de diagramas"
ON public.ch_diagramas_archivos FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Eliminación autenticada de diagramas"
ON public.ch_diagramas_archivos FOR DELETE
TO authenticated, anon
USING (true);

-- 4. Storage policies (permitir upload/download público para el prototipo)
CREATE POLICY "Lectura pública de archivos diagramas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'diagramas');

CREATE POLICY "Subida pública de archivos diagramas"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'diagramas');

CREATE POLICY "Eliminación pública de archivos diagramas"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'diagramas');
