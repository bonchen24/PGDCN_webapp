const fs = require('fs');

const routes = JSON.parse(fs.readFileSync('.agents/teamwork/explorer_api_contracts/routes_server.json', 'utf8'));
const serverContent = fs.readFileSync('server.ts', 'utf8');
const lines = serverContent.split('\n');

const analyzed = routes.map(r => {
  // Grab 20 lines around the route definition to see what middleware or auth checks are used
  const start = Math.max(0, r.line - 1);
  const end = Math.min(lines.length, r.line + 25);
  const snippet = lines.slice(start, end).join('\n');

  const authChecks = [];
  if (snippet.includes('requirePcnSession')) authChecks.push('requirePcnSession');
  if (snippet.includes('requirePcnAdmin')) authChecks.push('requirePcnAdmin');
  if (snippet.includes('requirePcnWorkflowManager')) authChecks.push('requirePcnWorkflowManager');
  if (snippet.includes('requirePcnMutation')) authChecks.push('requirePcnMutation');
  if (snippet.includes('requirePcnPersonnelAdmin')) authChecks.push('requirePcnPersonnelAdmin');
  if (snippet.includes('requirePcnDepartmentSessionMiddleware')) authChecks.push('requirePcnDepartmentSessionMiddleware');
  if (snippet.includes('requirePgdSession')) authChecks.push('requirePgdSession');
  if (snippet.includes('requirePgdDossierManager')) authChecks.push('requirePgdDossierManager');
  if (snippet.includes('requirePgdWorkflowManager')) authChecks.push('requirePgdWorkflowManager');
  if (snippet.includes('requirePgdCollectionMutation')) authChecks.push('requirePgdCollectionMutation');
  if (snippet.includes('requirePgdcnNotificationMutation')) authChecks.push('requirePgdcnNotificationMutation');
  if (snippet.includes('requireAdmin')) authChecks.push('requireAdmin');
  if (snippet.includes('verifyHmac') || snippet.includes('createHmac')) authChecks.push('HMAC');

  let domain = 'OTHER';
  if (r.path.startsWith('/api/pcn/')) domain = 'PCN';
  else if (r.path.startsWith('/api/pgd/')) domain = 'PGD';
  else if (r.path.startsWith('/api/pgdcn/')) domain = 'PGDCN';
  else if (r.path.startsWith('/api/auth/')) domain = 'AUTH';
  else if (r.path.startsWith('/api/db')) domain = 'DB';
  else if (r.path.startsWith('/api/activity-logs')) domain = 'AUDIT';
  else if (r.path.startsWith('/api/backups')) domain = 'BACKUP';
  else if (r.path.startsWith('/api/gemini')) domain = 'AI';
  else if (r.path.startsWith('/api/kqtn')) domain = 'KQTN';

  return {
    line: r.line,
    method: r.method,
    path: r.path,
    domain,
    authChecks
  };
});

fs.writeFileSync('.agents/teamwork/explorer_api_contracts/analyzed_routes.json', JSON.stringify(analyzed, null, 2));

console.log('Total analyzed routes:', analyzed.length);

const domainCounts = {};
analyzed.forEach(a => {
  domainCounts[a.domain] = (domainCounts[a.domain] || 0) + 1;
});
console.log('Domain breakdown:', domainCounts);

const withoutAuth = analyzed.filter(a => a.authChecks.length === 0 && !['/api/health', '/api/db/health', '/api/auth/pcn-session'].includes(a.path));
console.log('Routes without explicit require* in top 25 lines:', withoutAuth.length);
fs.writeFileSync('.agents/teamwork/explorer_api_contracts/routes_without_auth.json', JSON.stringify(withoutAuth, null, 2));
