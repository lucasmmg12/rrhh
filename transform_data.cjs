
const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('org_structure.json', 'utf8'));

// Function to clean the tree
function cleanTree(nodes) {
    let cleanedNodes = [];

    nodes.forEach(node => {
        // Process children first
        let children = node.children ? cleanTree(node.children) : [];

        // Determine if this node is "valid"
        // Valid = has meaningful text AND is not a purely presentational/helper type without children?
        // Actually, helper nodes might bridge the gap.
        // If a node has NO name, it is likely a helper node.

        const isPres = node.type === 'pres' || node.type === 'parTrans' || node.type === 'sibTrans';
        const hasName = node.name && node.name.trim().length > 0 && node.name !== "Sin Texto";

        // Logic:
        // If node has name -> Keep it (and attach processed children).
        // If node has NO name -> It's a passthrough. Return its children to be added to the parent's list.

        if (hasName) {
            // It's a real node
            // Map properties to our app's format
            const newNode = {
                id: node.id,
                role: node.name,
                name: '', // We don't have names in the chart, just roles
                status: 'occupied', // Default
                type: determineType(node.name),
                children: children
            };

            cleanedNodes.push(newNode);
        } else {
            // It's a helper/layout node.
            // Promote its children to this level.
            cleanedNodes = cleanedNodes.concat(children);
        }
    });

    return cleanedNodes;
}

function determineType(roleName) {
    const lower = roleName.toLowerCase();
    if (lower.includes('director') || lower.includes('dirección')) return 'director';
    if (lower.includes('gerente')) return 'manager';
    if (lower.includes('jefe')) return 'chief';
    if (lower.includes('coordinador')) return 'coordinator';
    if (lower.includes('responsable')) return 'manager';
    return 'employee';
}

const cleanedRoot = cleanTree(rawData);

// The cleanTree might return multiple roots if the top node was a wrapper.
// We expect a single root representing "Dirección".

let finalData = {};
if (cleanedRoot.length === 1) {
    finalData = cleanedRoot[0];
} else {
    // If multiple roots, find the most likely main root (e.g. Dirección)
    const directionNode = cleanedRoot.find(n => n.role.includes('Dirección'));
    if (directionNode) {
        finalData = directionNode;
        // Attach others as children? Or ignore?
        // If there are disconnected roots in the diagram, we might need a virtual root.
        // But usually "Dirección" is the top.
        // Let's see if other roots are actually orphans or should be under Dirección.

        // For now, let's wrap them in a virtual root if multiple.
        if (cleanedRoot.length > 1) {
            console.log("Warning: Multiple roots found, checking logic.");
            // If Direction is one of them, maybe others are unconnected sub-charts?
            // Let's just use Direction if found.
        }
    } else {
        // Fallback
        finalData = {
            id: 'root',
            role: 'Organigrama',
            name: 'Sanatorio Argentino',
            status: 'occupied',
            type: 'director',
            children: cleanedRoot
        };
    }
}

// Convert to module format string
const fileContent = `
export const orgData = ${JSON.stringify(finalData, null, 2)};
`;

fs.writeFileSync('src/data.js', fileContent);
console.log("Generated src/data.js");
