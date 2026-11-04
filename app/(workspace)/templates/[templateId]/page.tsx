'use client';

import React, { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import PgdcnDossierTemplateEditor from '@/components/PgdcnDossierTemplateEditor';
import type { DossierTemplateRequirementOption } from '@/components/PgdcnDossierTemplateInspector';
import {
  toPcnDossierTemplateEditorModel,
  toPgdDossierTemplateEditorModel,
  fromPcnDossierTemplateEditorModel,
  fromPgdDossierTemplateEditorModel,
  type DossierTemplateEditorModel,
} from '@/utils/pgdcnDossierTemplate';
import { getPgdDossierRequirements } from '@/utils/pgdDossier';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { Button } from '@/components/ui/button';

export default function TemplateDesignerPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const templateId = resolvedParams.templateId;

  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();

  const pcnTemplate = pcn.workflowTemplates.find((t) => t.id === templateId);
  const pgdTemplate = pgd.workflowTemplates.find((t) => t.id === templateId);
  const domain = pcnTemplate ? 'PCN' : pgdTemplate ? 'PGD' : null;

  const initialModel = useMemo<DossierTemplateEditorModel | null>(() => {
    if (pcnTemplate) return toPcnDossierTemplateEditorModel(pcnTemplate, pcn.documentRequirements);
    if (pgdTemplate) {
      const pgdRequirements = Array.from(
        new Map(
          (['OTHER', 'STEEL_METAL', 'MACHINERY_LINE', 'COAL'] as const)
            .flatMap((group) => getPgdDossierRequirements(group))
            .map((item) => [item.code, item])
        ).values()
      );
      return toPgdDossierTemplateEditorModel(pgdTemplate, pgdRequirements);
    }
    return null;
  }, [pcn.documentRequirements, pcnTemplate, pgdTemplate]);

  const [model, setModel] = useState<DossierTemplateEditorModel | null>(initialModel);
  const [saving, setSaving] = useState(false);

  const requirements: DossierTemplateRequirementOption[] = useMemo(() => {
    if (domain === 'PCN') {
      return pcn.documentRequirements.map((r) => ({
        id: r.id,
        label: r.name,
        description: r.description,
        group: r.fieldCode,
        required: r.required,
      }));
    }
    const pgdRequirements = Array.from(
      new Map(
        (['OTHER', 'STEEL_METAL', 'MACHINERY_LINE', 'COAL'] as const)
          .flatMap((group) => getPgdDossierRequirements(group))
          .map((item) => [item.code, item])
      ).values()
    );
    return pgdRequirements.map((r) => ({
      id: r.code,
      label: r.title,
      description: r.description,
      group: r.group,
      required: r.required,
    }));
  }, [domain, pcn.documentRequirements]);

  if (!currentUser) return null;

  if (!model || !domain) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3 border border-amber-200">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-base font-bold text-slate-900">Không tìm thấy bộ hồ sơ mẫu</h2>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Mã template <span className="font-mono font-semibold">{templateId}</span> không tồn tại trong hệ thống.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1.5 text-xs font-semibold"
          onClick={() => router.push('/templates')}
        >
          <ArrowLeft size={14} /> Quay lại Danh mục bộ mẫu
        </Button>
      </div>
    );
  }

  const canMutate =
    domain === 'PCN'
      ? isPcnSystemManager(currentUser)
      : ['PGD_ADMIN', 'PGD_MANAGER'].includes(String(currentUser.pgdRole || '').toUpperCase()) ||
        currentUser.systemRole === 'admin';

  const handleSave = async (updatedModel: DossierTemplateEditorModel) => {
    setSaving(true);
    try {
      if (domain === 'PCN' && pcnTemplate) {
        const payload = fromPcnDossierTemplateEditorModel(updatedModel, pcnTemplate);
        await pcn.updateWorkflowTemplate(payload.id, payload);
      } else if (domain === 'PGD' && pgdTemplate) {
        const payload = fromPgdDossierTemplateEditorModel(updatedModel, pgdTemplate);
        await pgd.updateWorkflowTemplate(payload.id, payload);
      }
      toast.success('Đã lưu cấu hình bộ hồ sơ mẫu thành công');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu bộ hồ sơ mẫu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-3 p-3 md:p-5">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          onClick={() => router.push('/templates')}
        >
          <ArrowLeft size={14} /> Quay lại danh mục bộ mẫu
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-500">{model.code}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            v{model.version}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-xs">
        <PgdcnDossierTemplateEditor
          model={model}
          requirements={requirements}
          onChange={(newModel) => setModel(newModel)}
          onSaveDraft={handleSave}
          canMutate={canMutate && model.status !== 'RETIRED'}
          saving={saving}
        />
      </div>
    </div>
  );
}
