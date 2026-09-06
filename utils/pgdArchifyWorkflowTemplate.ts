import type { ArchifyWorkflowDocument } from './pcnArchifyWorkflow.ts';
import { buildDossierTemplateArchifyWorkflow } from './pcnArchifyWorkflowTemplate.ts';
import type { DossierTemplateEditorModel } from './pgdcnDossierTemplate.ts';

export function buildPgdArchifyWorkflowTemplate(model: DossierTemplateEditorModel): ArchifyWorkflowDocument {
  if (model.domain !== 'PGD') throw new Error('Preview PGD cần model domain PGD.');
  return buildDossierTemplateArchifyWorkflow(model, 'PGD');
}
