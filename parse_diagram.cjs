
const fs = require('fs');
const path = 'c:/Users/Sanatorio Argentino/Desktop/Proyectos/RRHH/temp_org_content/word/diagrams/data1.xml';

try {
    const xml = fs.readFileSync(path, 'utf8');

    const nodes = {};

    // Use regex to find start of pts.
    // Note: modelId can be in simple quotes or double quotes, but usually double in generated XML.
    const nodeStartRegex = /<dgm:pt modelId="([^"]+)"([^>]*)>/g;

    let match;
    while ((match = nodeStartRegex.exec(xml)) !== null) {
        const id = match[1];
        const attributes = match[2];

        // Extract type if present
        const typeMatch = attributes.match(/type="([^"]+)"/);
        const type = typeMatch ? typeMatch[1] : 'node'; // Default to 'node' if type is missing (usually actual content nodes)

        const startIndex = match.index;
        const nextPtMatch = xml.indexOf('<dgm:pt ', startIndex + 1);
        const endIndex = nextPtMatch === -1 ? xml.lastIndexOf('</dgm:ptLst>') : nextPtMatch;

        const nodeContent = xml.substring(startIndex, endIndex);

        // Extract text
        const textRegex = /<a:t>([^<]+)<\/a:t>/g;
        let textMatch;
        let fullText = '';
        while ((textMatch = textRegex.exec(nodeContent)) !== null) {
            fullText += textMatch[1] + ' ';
        }

        fullText = fullText.trim();

        // Extract hidden or placeholder text properties if needed, but <a:t> is usually the visible text.

        nodes[id] = { id, text: fullText, type };
    }

    // 2. Extract Connections
    const edges = [];
    const cxnRegex = /<dgm:cxn [^>]*srcId="([^"]+)" [^>]*destId="([^"]+)"/g;

    while ((match = cxnRegex.exec(xml)) !== null) {
        edges.push({ from: match[1], to: match[2] });
    }

    // console.log("Nodes Found:", Object.keys(nodes).length);
    // console.log("Edges Found:", edges.length);

    // Construct Tree
    const childMap = {};
    const parentMap = {};

    edges.forEach(edge => {
        // Filter edges? Sometimes edges connect to hidden nodes.
        if (!childMap[edge.from]) childMap[edge.from] = [];
        childMap[edge.from].push(edge.to);
        parentMap[edge.to] = edge.from;
    });

    // Identify roots
    // Roots are nodes that have no parent in the map.
    // But we should also filter out auxiliary nodes from being roots if possible, or handle them.
    // Usually, the real root is unique.

    const allNodeIds = Object.keys(nodes);
    let roots = allNodeIds.filter(id => !parentMap[id]);

    // Filter roots to likely candidates (e.g. not presentation nodes if possible, though sometimes keys don't carry type info in maps)
    // Let's rely on type from node map.

    function buildTree(id) {
        const node = nodes[id];
        if (!node) return { id, name: "Unknown Node", type: 'unknown' };

        const childrenIds = childMap[id] || [];
        const children = childrenIds.map(buildTree); // Recursion

        return {
            id: node.id,
            name: node.text || "", // Empty string if no text
            type: node.type,
            children: children.length > 0 ? children : []
        };
    }

    const fullTree = roots.map(buildTree);

    // Clean up the tree: remove nodes that are effectively empty/auxiliary if they are leaf nodes?
    // Or better, just output everything to a JSON file and I'll analyze it.

    fs.writeFileSync('org_structure.json', JSON.stringify(fullTree, null, 2));
    console.log("JSON written to org_structure.json");

} catch (err) {
    console.error("Error:", err);
}
