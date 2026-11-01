import PgdcnAppShell from '../../components/PgdcnAppShell';
import type { PgdcnSharedSection } from '../../components/PgdcnSidebar';

const VALID_DEPARTMENT_SECTIONS: ReadonlySet<string> = new Set<PgdcnSharedSection>([
  'department-dashboard',
  'my-work',
  'customers',
  'assistant',
  'activityLogs',
  'system-settings',
  'dossier-templates',
  'document-drafting',
]);

function getInitialDepartmentSection(value: string | string[] | undefined): PgdcnSharedSection | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && VALID_DEPARTMENT_SECTIONS.has(candidate) ? (candidate as PgdcnSharedSection) : undefined;
}

export default async function PgdcnLandingPage(props: {
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const resolved = props.searchParams ? await props.searchParams : undefined;
  const initialDepartmentSection = getInitialDepartmentSection(resolved?.section);
  return <PgdcnAppShell initialDomain="department" initialDepartmentSection={initialDepartmentSection} />;
}
