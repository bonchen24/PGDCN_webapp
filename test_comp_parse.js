const fs = require('fs');
const content = fs.readFileSync('components/ReportGeneratorView.tsx', 'utf-8');

let braceCount = 0;
let inString = False;
let stringChar = null;
let escape = False;

let exportDefaultFound = false;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  // check for export default function ReportGeneratorView() {
  if (content.substring(i, i+45) === "export default function ReportGeneratorView() {") {
    exportDefaultFound = true;
    braceCount = 1;
    i += 45;
    continue;
  }
  
  if (!exportDefaultFound) continue;

  if (escape) {
    escape = false;
    continue;
  }
  
  if (char === '\\') {
    escape = true;
    continue;
  }
  
  if (inString) {
    if (char === stringChar) {
      inString = false;
    }
    continue;
  }
  
  if (char === '"' || char === "'" || char === '`') {
    inString = true;
    stringChar = char;
    continue;
  }
  
  if (char === '{') braceCount++;
  else if (char === '}') {
    braceCount--;
    if (braceCount === 0) {
      console.log("End of component found at index " + i + ". Total length: " + content.length);
      console.log("Difference is " + (content.length - i));
      break;
    }
  }
}
