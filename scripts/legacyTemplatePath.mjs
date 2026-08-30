// Author: Gemini
// OS support: Web/Node
// Description: Resolve legacy DDT template fixtures without restoring them to public runtime assets

import fs from 'node:fs';
import path from 'node:path';

export function resolveLegacyTemplatePath(templatePath, rootDir = process.cwd()) {
  const root = path.resolve(rootDir);
  const requested = path.isAbsolute(templatePath) ? templatePath : path.resolve(root, templatePath);
  if (fs.existsSync(requested)) return requested;

  const relative = path.relative(root, requested);
  const publicPrefix = `public${path.sep}`;
  if (!relative.startsWith(publicPrefix)) return requested;

  const buildArtifact = path.join(root, 'dist', relative.slice(publicPrefix.length));
  return fs.existsSync(buildArtifact) ? buildArtifact : requested;
}
