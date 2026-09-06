// Author: Codex
// OS support: Web/Node
// Description: Pure row projection for the PCN sample management ledger.

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnSampleItem,
  PcnSampleLabCode,
  PcnSampleLot,
  PcnSampleRequestBundle,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types.ts';

export interface PcnSampleRegisterLabCell {
  labCode: PcnSampleLabCode;
  labName: string;
  routeId: string;
  routeStatus: PcnSampleRoute['status'];
  pycNumber?: string;
  syncStatus?: string;
  externalRequestCode?: string;
  resultId?: string;
  resultOutcome?: ReturnedTestResult['outcome'];
  bundleId?: string;
  dispatchId?: string;
  dispatchStatus?: PcnSampleRequestBundle['dispatches'][number]['status'];
}

export interface PcnSampleRegisterRow {
  id: string;
  sampleItemId: string;
  sampleLotId: string;
  lotCode: string;
  sampleCode: string;
  sampleType: string;
  model: string;
  brand?: string;
  quantity: number;
  unit?: string;
  customerName: string;
  dossierCode: string;
  proposalCode: string;
  currentLocation: string;
  lotStatus: PcnSampleLot['status'];
  labCells: Partial<Record<PcnSampleLabCode, PcnSampleRegisterLabCell>>;
  bundleIds: string[];
}

export interface PcnSampleRegisterInput {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  bundles: PcnSampleRequestBundle[];
  returnedResults: ReturnedTestResult[];
}

function resultForRequest(request: OutboundLabRequest | undefined, results: ReturnedTestResult[]): ReturnedTestResult | undefined {
  if (!request) return undefined;
  return results.find((result) => result.labRequestId === request.id);
}

export function buildSampleRegisterRows(input: PcnSampleRegisterInput): PcnSampleRegisterRow[] {
  const dossierById = new Map(input.dossiers.map((dossier) => [dossier.id, dossier]));
  const proposalById = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));
  const lotById = new Map(input.sampleLots.map((lot) => [lot.id, lot]));
  const bundlesByItemId = new Map<string, Array<{ bundle: PcnSampleRequestBundle; dispatch: PcnSampleRequestBundle['dispatches'][number] }>>();
  for (const bundle of input.bundles) {
    for (const sampleItemId of bundle.sampleItemIds) {
      const entries = bundlesByItemId.get(sampleItemId) || [];
      for (const dispatch of bundle.dispatches) entries.push({ bundle, dispatch });
      bundlesByItemId.set(sampleItemId, entries);
    }
  }
  const rows: PcnSampleRegisterRow[] = [];
  for (const item of input.sampleItems) {
    const lot = lotById.get(item.sampleLotId);
    if (!lot) continue;
    const dossier = dossierById.get(lot.dossierId);
    const proposal = dossier ? proposalById.get(dossier.proposalId) : undefined;
    const routes = input.sampleRoutes.filter((route) => route.sampleLotId === lot.id && route.sampleItemIds?.includes(item.id));
    const labCells: PcnSampleRegisterRow['labCells'] = {};
    for (const route of routes) {
      const request = input.labRequests.find((candidate) => candidate.sampleRouteId === route.id);
      const result = resultForRequest(request, input.returnedResults);
      const bundleEntry = (bundlesByItemId.get(item.id) || []).find((entry) => entry.dispatch.labCode === route.labCode);
      labCells[route.labCode] = {
        labCode: route.labCode,
        labName: route.labName || PCN_SAMPLE_LAB_OPTIONS.find((option) => option.code === route.labCode)?.name || route.labCode,
        routeId: route.id,
        routeStatus: route.status,
        ...(request ? { pycNumber: request.pycNumber, syncStatus: request.integration?.syncStatus, externalRequestCode: request.integration?.externalRequestCode } : {}),
        ...(result ? { resultId: result.id, resultOutcome: result.outcome } : {}),
        ...(bundleEntry ? { bundleId: bundleEntry.bundle.id, dispatchId: bundleEntry.dispatch.id, dispatchStatus: bundleEntry.dispatch.status } : {}),
      };
    }
    rows.push({
      id: item.id,
      sampleItemId: item.id,
      sampleLotId: lot.id,
      lotCode: lot.lotCode,
      sampleCode: item.sampleCode,
      sampleType: item.sampleType,
      model: item.model,
      ...(item.brand || lot.brand ? { brand: item.brand || lot.brand } : {}),
      quantity: item.quantity,
      unit: item.unit || lot.unit,
      customerName: dossier?.customerSnapshot?.name || proposal?.customerSnapshot.name || 'Chưa có khách hàng',
      dossierCode: dossier?.dossierCode || lot.dossierId,
      proposalCode: proposal?.proposalCode || dossier?.proposalId || '—',
      currentLocation: lot.currentLocation,
      lotStatus: lot.status,
      labCells,
      bundleIds: input.bundles.filter((bundle) => bundle.sampleItemIds.includes(item.id)).map((bundle) => bundle.id),
    });
  }
  return rows;
}

// --- End of pcnSampleRegister.ts ---
