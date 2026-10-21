const fs = require('fs');

const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');

const routes = [];
lines.forEach((line, idx) => {
  const m = line.match(/^\s*app\.(get|post|put|delete|patch)\((['"][^'"]+['"])(.*)/);
  if (m) {
    const rawPath = m[2].slice(1, -1);
    const rest = m[3] || '';
    routes.push({
      line: idx + 1,
      method: m[1].toUpperCase(),
      path: rawPath,
      context: rest.trim().slice(0, 100)
    });
  }
});

fs.writeFileSync('.agents/teamwork/explorer_api_contracts/routes_server.json', JSON.stringify(routes, null, 2));
console.log(`Extracted ${routes.length} routes from server.ts`);

// Group by prefix
const prefixes = {};
routes.forEach(r => {
  const parts = r.path.split('/');
  const prefix = parts.slice(0, 3).join('/') || '/';
  prefixes[prefix] = (prefixes[prefix] || 0) + 1;
});
console.log('Route counts by prefix:', prefixes);
