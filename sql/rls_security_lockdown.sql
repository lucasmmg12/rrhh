-- ============================================================
-- MIGRACIÓN DE SEGURIDAD: Principio de Privilegio Mínimo
-- Sanatorio Argentino SRL — RRHH
-- 
-- REGLA: Solo la Agenda Pública es accesible sin autenticación.
--        Todo lo demás requiere autenticación (role = authenticated).
-- 
-- Ejecutar en Supabase SQL Editor como superuser.
-- ============================================================

-- ┌──────────────────────────────────────────────────────────────┐
-- │  1. CALENDARIO — calendar_events                            │
-- │     Público: solo lectura (Agenda Pública)                  │
-- │     Autenticado: lectura + escritura completa                │
-- └──────────────────────────────────────────────────────────────┘

-- Habilitar RLS (si no está habilitado)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas permisivas existentes
DROP POLICY IF EXISTS "Allow all on calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Enable all access for calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Allow public read calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Allow auth write calendar_events" ON calendar_events;

-- Anón: solo lectura
CREATE POLICY "anon_read_calendar_events"
  ON calendar_events
  FOR SELECT
  TO anon
  USING (true);

-- Autenticado: CRUD completo
CREATE POLICY "auth_all_calendar_events"
  ON calendar_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  2. CALENDARIO — calendar_attachments                       │
-- │     Solo accesible por autenticados                          │
-- └──────────────────────────────────────────────────────────────┘

ALTER TABLE calendar_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on calendar_attachments" ON calendar_attachments;
DROP POLICY IF EXISTS "Enable all access for calendar_attachments" ON calendar_attachments;
DROP POLICY IF EXISTS "Allow auth all calendar_attachments" ON calendar_attachments;

CREATE POLICY "auth_all_calendar_attachments"
  ON calendar_attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anón: solo lectura de adjuntos (para agenda pública si muestra archivos)
CREATE POLICY "anon_read_calendar_attachments"
  ON calendar_attachments
  FOR SELECT
  TO anon
  USING (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  3. ORGANIGRAMA — organization_nodes                        │
-- │     Sin acceso público. Solo autenticados.                  │
-- └──────────────────────────────────────────────────────────────┘

ALTER TABLE organization_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on organization_nodes" ON organization_nodes;
DROP POLICY IF EXISTS "Enable all access for organization_nodes" ON organization_nodes;
DROP POLICY IF EXISTS "Allow public read organization_nodes" ON organization_nodes;

CREATE POLICY "auth_all_organization_nodes"
  ON organization_nodes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  4. ORGANIGRAMA — node_attachments                          │
-- │     Sin acceso público. Solo autenticados.                  │
-- └──────────────────────────────────────────────────────────────┘

ALTER TABLE node_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on node_attachments" ON node_attachments;
DROP POLICY IF EXISTS "Enable all access for node_attachments" ON node_attachments;

CREATE POLICY "auth_all_node_attachments"
  ON node_attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  5. FICHADAS — fichadas_importaciones                       │
-- │     Sin acceso público. Solo autenticados.                  │
-- └──────────────────────────────────────────────────────────────┘

-- RLS ya habilitado en fichadas_schema.sql
DROP POLICY IF EXISTS "Allow all on fichadas_importaciones" ON fichadas_importaciones;

CREATE POLICY "auth_all_fichadas_importaciones"
  ON fichadas_importaciones
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  6. FICHADAS — fichadas_colaboradores                       │
-- │     Sin acceso público. Solo autenticados.                  │
-- └──────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Allow all on fichadas_colaboradores" ON fichadas_colaboradores;

CREATE POLICY "auth_all_fichadas_colaboradores"
  ON fichadas_colaboradores
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  7. FICHADAS — fichadas_registros                           │
-- │     Sin acceso público. Solo autenticados.                  │
-- └──────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Allow all on fichadas_registros" ON fichadas_registros;

CREATE POLICY "auth_all_fichadas_registros"
  ON fichadas_registros
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  8. FICHADAS — fichadas_totales_mensuales                   │
-- │     Sin acceso público. Solo autenticados.                  │
-- └──────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Allow all on fichadas_totales_mensuales" ON fichadas_totales_mensuales;

CREATE POLICY "auth_all_fichadas_totales_mensuales"
  ON fichadas_totales_mensuales
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  9. FICHADAS — fichadas_config_areas                        │
-- │     Sin acceso público. Solo autenticados.                  │
-- └──────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Allow all on fichadas_config_areas" ON fichadas_config_areas;

CREATE POLICY "auth_all_fichadas_config_areas"
  ON fichadas_config_areas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ┌──────────────────────────────────────────────────────────────┐
-- │  10. STORAGE BUCKETS (si aplica)                             │
-- │     Los buckets de storage tienen sus propias RLS policies.  │
-- │     Verificar manualmente en Dashboard > Storage > Policies  │
-- │     - avatars: solo authenticated                            │
-- │     - profile-documents: solo authenticated                  │
-- │     - calendar-attachments: lectura publica, write auth      │
-- └──────────────────────────────────────────────────────────────┘

-- NOTA: Las políticas de Storage se configuran desde el Dashboard 
-- de Supabase o con SQL sobre storage.objects.
-- Ejemplo para calendar-attachments (lectura pública):
-- 
-- CREATE POLICY "anon_read_calendar_attachments_storage"
--   ON storage.objects FOR SELECT
--   TO anon
--   USING (bucket_id = 'calendar-attachments');
--
-- CREATE POLICY "auth_all_calendar_attachments_storage"
--   ON storage.objects FOR ALL
--   TO authenticated
--   USING (bucket_id = 'calendar-attachments')
--   WITH CHECK (bucket_id = 'calendar-attachments');


-- ┌──────────────────────────────────────────────────────────────┐
-- │  VERIFICACIÓN: Listado de políticas activas                  │
-- └──────────────────────────────────────────────────────────────┘

-- Ejecutar después de la migración para verificar:
-- SELECT tablename, policyname, permissive, roles, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, policyname;
