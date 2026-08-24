const fs = require('fs');
const PizZip = require('./node_modules/pizzip');

function fix(filePath) {
  const zip = new PizZip(fs.readFileSync(filePath));
  let xml = zip.file('word/document.xml').asText();
  
  // Clean checkout from git first to be 100% sure we start from clean base
  const cleanZip = new PizZip(fs.readFileSync('public/maykhoan placeholder.docx.bak' || filePath));
}