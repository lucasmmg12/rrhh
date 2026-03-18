// Debug: count all collaborators across all pages
const fs = require('fs');
const path = require('path');

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  const pdfPath = path.resolve(__dirname, '..', 'fichadas neo (1).pdf');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  
  console.log(`Total pages in PDF: ${pdf.numPages}`);
  
  const collaborators = new Set();
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.map(item => ({
      text: item.str,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
    }));
    
    // Sort by Y desc, X asc
    items.sort((a, b) => {
      if (Math.abs(a.y - b.y) <= 3) return a.x - b.x;
      return b.y - a.y;
    });
    
    // Group into lines
    const lines = [];
    if (!items.length) continue;
    let currentLine = [items[0]];
    let currentY = items[0].y;
    
    for (let i = 1; i < items.length; i++) {
      if (Math.abs(items[i].y - currentY) <= 3) {
        currentLine.push(items[i]);
      } else {
        currentLine.sort((a, b) => a.x - b.x);
        lines.push(currentLine);
        currentLine = [items[i]];
        currentY = items[i].y;
      }
    }
    if (currentLine.length) {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
    }
    
    let pageCollabs = 0;
    for (const lineItems of lines) {
      const text = lineItems.map(i => i.text).join(' ').trim();
      const firstX = lineItems.filter(i => i.text.trim())[0]?.x || 999;
      
      // Collaborator name detection
      if (firstX < 100 && text.length >= 5 && !/^\d/.test(text) && 
          !/\d{2}:\d{2}/.test(text) && !/\d{1,2}-\w{3}/.test(text) &&
          !/sanatorio|horas|totalizadas|horario|fecha|fichadas|página|redondeo|trabajada/i.test(text)) {
        const upperCount = (text.match(/[A-ZÁÉÍÓÚÑÜ]/g) || []).length;
        const letterCount = (text.match(/[a-záéíóúñüA-ZÁÉÍÓÚÑÜ]/g) || []).length;
        if (letterCount >= 4 && upperCount / letterCount > 0.7) {
          collaborators.add(text.trim());
          pageCollabs++;
        }
      }
    }
    console.log(`  Page ${pageNum}: ${pageCollabs} collaborator names found`);
  }
  
  console.log(`\nTotal unique collaborators: ${collaborators.size}`);
  console.log('Names:');
  [...collaborators].sort().forEach((name, i) => console.log(`  ${i+1}. ${name}`));
}

main().catch(err => console.error('Error:', err.message));
