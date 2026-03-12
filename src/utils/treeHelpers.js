
// Helper to transform flat list from DB to nested tree for UI
export const buildTree = (flatNodes) => {
    if (!flatNodes || flatNodes.length === 0) return null;

    const nodeMap = {};
    const roots = [];

    // 1. Initialize map
    flatNodes.forEach(node => {
        // Ensure ID is clean (lowercase, no braces)
        const id = node.id.replace(/{/g, '').replace(/}/g, '').toLowerCase();
        nodeMap[id] = { ...node, id, children: [] };
    });

    // 2. Build Hierarchy
    flatNodes.forEach(node => {
        const id = node.id.replace(/{/g, '').replace(/}/g, '').toLowerCase();
        const parentId = node.parent_id ? node.parent_id.replace(/{/g, '').replace(/}/g, '').toLowerCase() : null;

        if (parentId && nodeMap[parentId]) {
            nodeMap[parentId].children.push(nodeMap[id]);
        } else {
            // No parent, so it's a root (or orphaned)
            roots.push(nodeMap[id]);
        }
    });

    // Return the main root (Director) or the array of roots if multiple
    if (roots.length === 1) return roots[0];
    // If multiple roots (e.g. data error or intentionally separate trees), return the one that looks like Director or just the first
    return roots.find(r => r.type === 'director') || roots[0];
};
