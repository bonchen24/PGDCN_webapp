// Author: Codex
// OS support: Node
// Description: Read-only source survey plus PCN standard dossier flow verification.

import fs from 'node:fs';
import path from 'node:path';

import { PCN_STANDARD_DOSSIER_FIXTURES, buildPcnStandardDossierFlow } from '../utils/pcnStandardDossierFlow.ts';

const sourceRoot = process.argv[2] || process.env.PCN_STANDARD_SOURCE_ROOT;

if (!sourceRoot) {
  console.error('Thiếu thư mục nguồn. Truyền PCN_STANDARD_SOURCE_ROOT hoặc tham số thư mục PCN Desktop.');
  process.exitCode = 2;
} else if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
  console.error(`Không tìm thấy thư mục nguồn PCN: ${sourceRoot}`);
  process.exitCode = 2;
} else {
  const collectFiles = (folder: string): string[] => fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(folder, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
  const normalizeName = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const allFiles = collectFiles(sourceRoot);
  const fileIndex = new Map<string, string[]>();
  for (const filePath of allFiles) {
    const key = normalizeName(path.basename(filePath));
    const matches = fileIndex.get(key) || [];
    matches.push(path.relative(sourceRoot, filePath).replaceAll('\\', '/'));
    fileIndex.set(key, matches);
  }

  const reports = PCN_STANDARD_DOSSIER_FIXTURES.map((fixture) => {
    const sourceFolder = path.join(sourceRoot, ...fixture.sourceRelativeFolder.split('/'));
    const expectedFiles = [...new Set(Object.values(fixture.sourceFiles).flatMap((files) => files))];
    const missingFiles = expectedFiles.filter((fileName) => !fileIndex.has(normalizeName(fileName)));
    const flow = buildPcnStandardDossierFlow(fixture);
    return {
      sourceLabel: fixture.sourceLabel,
      sourceFolder: fixture.sourceRelativeFolder,
      sourceFolderExists: fs.existsSync(sourceFolder) && fs.statSync(sourceFolder).isDirectory(),
      expectedFileCount: expectedFiles.length,
      missingFiles,
      matchedFileCount: expectedFiles.length - missingFiles.length,
      dossierCode: fixture.dossierCode,
      fieldCode: fixture.fieldCode,
      method: fixture.method,
      flow: {
        finalDossierStatus: flow.dossier.status,
        issuanceStatus: flow.issuance.status,
        sampleLotStatus: flow.sampleLot.status,
        routeStatuses: flow.sampleRoutes.map((route) => ({ labCode: route.labCode, status: route.status })),
        resultCount: flow.returnedResults.length,
        waivedRequirementIds: flow.waivedRequirementIds,
        allStageGatesComplete: flow.stageGates.every((gate) => gate.complete),
      },
    };
  });

  const ok = reports.every((report) => report.sourceFolderExists && report.missingFiles.length === 0 && report.flow.finalDossierStatus === 'ARCHIVED' && report.flow.allStageGatesComplete);
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    sourceRoot: path.resolve(sourceRoot),
    readOnly: true,
    runtimeDependency: false,
    ok,
    reports,
  }, null, 2));
  process.exitCode = ok ? 0 : 1;
}

