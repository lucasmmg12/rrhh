
import { supabase, supabaseAdmin } from './supabaseClient';
import { orgData } from './data';
// UUID regex: 8-4-4-4-12 hex chars
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stripBraces = (uuid) => uuid.replace(/{/g, '').replace(/}/g, '');

// Cache: maps original ID string -> valid UUID
const idMap = new Map();

const toValidUUID = (rawId) => {
    const stripped = stripBraces(rawId).toLowerCase();
    if (UUID_RE.test(stripped)) return stripped; // Already valid UUID
    // Check cache for deterministic mapping
    if (idMap.has(rawId)) return idMap.get(rawId);
    // Generate a new UUID for non-UUID IDs
    const newUuid = crypto.randomUUID();
    idMap.set(rawId, newUuid);
    return newUuid;
};

// Recursive function to flatten the tree
const flattenHierarchy = (node, parentId = null, nodesAcc = []) => {
    const nodeId = toValidUUID(node.id);

    // Create the flattened node object
    const flatNode = {
        id: nodeId,
        role: node.role,
        name: node.name || null,
        status: node.status || 'vacancy',
        type: node.type || 'employee',
        parent_id: parentId, // Use the proper parent UUID
        photo_url: node.photoUrl || null,
        profile: node.profile || null,
        tasks: node.tasks ? JSON.stringify(node.tasks) : null,
        hierarchy_level: node.hierarchy_level ?? 3,
        relationship: node.relationship || 'line'
    };

    nodesAcc.push(flatNode);

    // Process children
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            flattenHierarchy(child, nodeId, nodesAcc);
        });
    }

    return nodesAcc;
};

export const seedDatabase = async () => {
    console.log("Starting database seed...");
    idMap.clear(); // Reset UUID mapping for fresh seed
    // Use admin client if available for cleanup
    const client = supabaseAdmin || supabase;

    try {
        // 1. Clear existing data (optional, but good for reset)
        // Be careful in prod!
        const { error: deleteError } = await client
            .from('organization_nodes')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (UUID condition is just a hack to select all if needed, but delete() without filters deletes all usually)

        if (deleteError) {
            console.error("Error clearing table:", deleteError);
            // If table doesn't exist, we might get error here.
        }

        // 2. Flatten data
        const flatNodes = flattenHierarchy(orgData);
        console.log(`Prepared ${flatNodes.length} nodes for insertion.`);

        // 3. Insert data
        // Supabase bulk insert
        const { data, error } = await client
            .from('organization_nodes')
            .upsert(flatNodes, { onConflict: 'id' });

        if (error) {
            console.error("Error seeding data:", error);
            return { success: false, error: error.message };
        } else {
            console.log("Database seeded successfully!", data);
            return { success: true, count: flatNodes.length };
        }

    } catch (err) {
        console.error("Unexpected error during seed:", err);
        return { success: false, error: err.message };
    }
};
