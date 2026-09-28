// Author: Gemini
// OS support: Web/Node
// Description: Core document collections and mappings for Next.js App Router API

export const PCN_DB_COLLECTIONS = new Set([
  'pcnCertificationFields',
  'certificationProposals',
  'certificationDossiers',
  'pcnDocumentRequirements',
  'pcnTemplateDefinitions',
  'pcnOfficialGeneratedDocuments',
  'dossierDocuments',
  'dossierAttachments',
  'pcnGeneratedDocuments',
  'pcnDraftWorkspaces',
  'pcnSampleLots',
  'pcnSampleItems',
  'pcnSampleRoutes',
  'pcnSampleFlowEvents',
  'pcnSampleRequestBundles',
  'labRequests',
  'returnedResults',
  'approvalSteps',
  'issuancePackages',
  'pcnSignerDelegations',
  'pcnQualityDocuments',
  'customers',
  'systemUsers',
  'pcnDepartmentRoles',
  'systemConfig',
  'userPreferences',
  'passwordResetRequests',
  'notifications',
  'activityLogs',
  'pcnWorkflowTemplates',
  'pcnDossierWorkflowTasks',
]);

export function isAllowedCollection(collectionName: string): boolean {
  return PCN_DB_COLLECTIONS.has(collectionName);
}

export function getDocumentPayload(value: any): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const data = { ...value };
  delete data.id;
  delete data.privateAssetVerified;
  delete data.privateAssetVerificationIssue;
  delete data.sourceInspection;
  return data;
}

export function mapDocumentRow(row: { document_id: string; data: Record<string, any> }) {
  return { ...(row.data || {}), id: row.document_id };
}
