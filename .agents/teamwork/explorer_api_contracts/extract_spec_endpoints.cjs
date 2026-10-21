const fs = require('fs');

const designContent = fs.readFileSync('design.md', 'utf8');
const designLines = designContent.split('\n');

// Find all occurrences of HTTP methods + path in design.md
const endpointRegex = /(GET|POST|PUT|DELETE|PATCH)\s+([/][a-zA-Z0-9_\-/:*]+)/g;
const specEndpoints = [];

designLines.forEach((line, idx) => {
  let match;
  while ((match = endpointRegex.exec(line)) !== null) {
    specEndpoints.push({
      line: idx + 1,
      method: match[1],
      path: match[2]
    });
  }
});

console.log('Found', specEndpoints.length, 'endpoint mentions in design.md');

// Deduplicate
const uniqueSpec = [];
const seen = new Set();
specEndpoints.forEach(e => {
  const key = `${e.method} ${e.path}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueSpec.push(e);
  }
});

console.log('Unique spec endpoints:', uniqueSpec.length);
fs.writeFileSync('.agents/teamwork/explorer_api_contracts/spec_endpoints.json', JSON.stringify(uniqueSpec, null, 2));
console.log(JSON.stringify(uniqueSpec, null, 2));
