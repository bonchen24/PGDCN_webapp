export const ARCHIFY_DIAGRAM_TYPES = ['workflow', 'lifecycle', 'dataflow', 'sequence', 'architecture'] as const;

export type ArchifyDiagramType = typeof ARCHIFY_DIAGRAM_TYPES[number];

export type ArchifyDiagramUnavailable = {
  available: false;
  diagramType: ArchifyDiagramType;
  reason: string;
};

export type ArchifyDiagramAvailable<T> = {
  available: true;
  diagramType: ArchifyDiagramType;
  document: T;
};

export type ArchifyDiagramResult<T> = ArchifyDiagramUnavailable | ArchifyDiagramAvailable<T>;

export interface ArchifyDiagramSuite<WorkflowDocument, LifecycleDocument = unknown, DataflowDocument = unknown, SequenceDocument = unknown, ArchitectureDocument = unknown> {
  workflow: WorkflowDocument;
  lifecycle: ArchifyDiagramResult<LifecycleDocument>;
  dataflow: ArchifyDiagramResult<DataflowDocument>;
  sequence: ArchifyDiagramResult<SequenceDocument>;
  architecture: ArchifyDiagramResult<ArchitectureDocument>;
}

function normalizeIdentifierPart(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function unicodeDisambiguator(value: string): string {
  const codePoints = Array.from(value, (character) => character.codePointAt(0)!.toString(16));
  return codePoints.length > 0 ? `~u${codePoints.join('x')}` : '';
}

export function archifyStableId(prefix: string, value: string): string {
  const normalizedPrefix = normalizeIdentifierPart(prefix) || 'archify';
  const normalizedValue = normalizeIdentifierPart(value) || 'unknown';
  const disambiguator = /[^\x00-\x7F]/.test(value) ? unicodeDisambiguator(value) : '';
  return `${normalizedPrefix}-${normalizedValue}${disambiguator}`;
}

export function unavailableDiagram(diagramType: ArchifyDiagramUnavailable['diagramType'], reason: string): ArchifyDiagramUnavailable {
  return { available: false, diagramType, reason: String(reason).trim() };
}
