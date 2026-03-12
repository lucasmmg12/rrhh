-- Organization Nodes Table (v2 — Hierarchy Refactor)
CREATE TABLE IF NOT EXISTS organization_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'vacancy',
    type TEXT,
    parent_id UUID REFERENCES organization_nodes(id) ON DELETE SET NULL,
    photo_url TEXT,
    profile TEXT,
    tasks JSONB,
    position INTEGER DEFAULT 0,
    -- v2: New fields for hierarchy refactor
    hierarchy_level INTEGER DEFAULT 3,         -- 0=Socios, 1=Dirección, 2=Staff/Soporte, 3=Jefes operativos
    relationship TEXT DEFAULT 'line',           -- 'line' (solid) or 'staff' (dashed/dotted)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_parent_id ON organization_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_role ON organization_nodes(role);
CREATE INDEX IF NOT EXISTS idx_hierarchy_level ON organization_nodes(hierarchy_level);

-- Node Attachments Table (for PDF/Word profile documents)
CREATE TABLE IF NOT EXISTS node_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES organization_nodes(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT,                              -- 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', etc.
    file_size INTEGER,                           -- bytes
    storage_path TEXT NOT NULL,                  -- path in Supabase Storage bucket
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachment_node_id ON node_attachments(node_id);

-- RLS (Row Level Security) Policies
ALTER TABLE organization_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_attachments ENABLE ROW LEVEL SECURITY;

-- Organization Nodes Policies
CREATE POLICY "Allow public read access" ON organization_nodes
FOR SELECT USING (true);

CREATE POLICY "Allow public write access" ON organization_nodes
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON organization_nodes
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON organization_nodes
FOR DELETE USING (true);

-- Node Attachments Policies
CREATE POLICY "Allow public read attachments" ON node_attachments
FOR SELECT USING (true);

CREATE POLICY "Allow public insert attachments" ON node_attachments
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete attachments" ON node_attachments
FOR DELETE USING (true);

-- Migration script for existing databases:
-- ALTER TABLE organization_nodes ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 3;
-- ALTER TABLE organization_nodes ADD COLUMN IF NOT EXISTS relationship TEXT DEFAULT 'line';
