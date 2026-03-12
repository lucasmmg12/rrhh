
const fs = require('fs');
const path = 'c:/Users/Sanatorio Argentino/Desktop/Proyectos/RRHH/temp_org_content/word/diagrams/data1.xml';

try {
    const xml = fs.readFileSync(path, 'utf8');
    // Simple regex to extract ALL text between <a:t> tags
    const textRegex = /<a:t>([^<]+)<\/a:t>/g;
    let match;
    const allText = [];
    while ((match = textRegex.exec(xml)) !== null) {
        allText.push(match[1]);
    }

    console.log("Found " + allText.length + " text fragments.");
    console.log(JSON.stringify(allText, null, 2));

} catch (err) {
    console.error(err);
}
