'use client';

import { Settings2, ShieldCheck, Users } from 'lucide-react';

import type { PcnCertificationField, PcnTemplateDefinition, PcnTemplateReviewAction, PcnUserAccount, UserAccount } from '../types';
import type { PcnDepartmentRole, PcnUserInput } from '../utils/pcnUserApi';
import { canManageSystemUsers, canViewSystemSettings } from '../utils/systemSettingsPolicy';
import { isPcnSystemManager } from '../utils/pcnRbac';
import PcnSettingsView from './PcnSettingsView';
import PcnUserManagementView from './PcnUserManagementView';
import PcnWorkflowTemplateManagementView from './PcnWorkflowTemplateManagementView';
import type { PcnWorkflowTemplate } from '../types';

type PgdcnSystemSettingsViewProps = {
  currentUser: PcnUserAccount;
  users: PcnUserAccount[];
  roles: PcnDepartmentRole[];
  fields: PcnCertificationField[];
  pcnTemplates: PcnTemplateDefinition[];
  onUploadPcnTemplate: (templateId: string, file: File) => Promise<unknown>;
  onReviewPcnTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown>;
  onCreate: (input: PcnUserInput) => Promise<void>;
  onUpdate: (username: string, input: Omit<PcnUserInput, 'username'>) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  onResetPassword: (username: string, password: string) => Promise<void>;
  workflowTemplates: PcnWorkflowTemplate[];
  onCreateWorkflowRevision: (templateId: string, template: PcnWorkflowTemplate) => Promise<PcnWorkflowTemplate>;
  onPublishWorkflowTemplate: (templateId: string) => Promise<PcnWorkflowTemplate>;
  onRetireWorkflowTemplate: (templateId: string, reason: string) => Promise<PcnWorkflowTemplate>;
};

export default function PgdcnSystemSettingsView({ currentUser, users, roles, fields, pcnTemplates, onUploadPcnTemplate, onReviewPcnTemplate, onCreate, onUpdate, onDelete, onResetPassword, workflowTemplates, onCreateWorkflowRevision, onPublishWorkflowTemplate, onRetireWorkflowTemplate }: PgdcnSystemSettingsViewProps) {
  const canView = canViewSystemSettings(currentUser);
  const canManage = canManageSystemUsers(currentUser);
  const canManageWorkflow = isPcnSystemManager(currentUser);

  if (!canView) return <div className="pcn-page-surface min-w-0 p-5 text-sm font-bold text-rose-700">Tài khoản hiện tại không có quyền xem Cài đặt hệ thống.</div>;

  return <div className="pcn-page-surface min-w-0 mobile-safe-bottom space-y-3 bg-slate-50/60 p-3 md:p-5">
    <header className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"><div className="flex items-start gap-2"><div className="rounded-lg bg-slate-900 p-2 text-white"><Settings2 size={16} /></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">PGDCN • Quản trị chung</p><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Cài đặt hệ thống</h1><p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">Nhân sự, cấu hình nghiệp vụ và thiết lập dùng chung cho hai miền. Admin hoặc Quản lý gán trực tiếp <code>departmentScopes</code>, <code>position</code>, vai trò nghiệp vụ và phạm vi lĩnh vực cho từng người; nút Reset mật khẩu chỉ tạo mật khẩu mới, không hiển thị mật khẩu hiện tại.</p></div></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-600"><span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1"><Users size={13} className="text-emerald-600" /> Nhân sự &amp; tài khoản</span><span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1"><ShieldCheck size={13} className="text-blue-600" /> {canManage ? 'Có quyền quản trị tài khoản' : 'Chỉ xem theo quyền được cấp'}</span><span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1"><Settings2 size={13} className="text-violet-600" /> Cấu hình PCN</span></div></header>
    <section aria-labelledby="system-personnel-heading"><h2 id="system-personnel-heading" className="mb-2 px-1 text-sm font-black text-slate-900">Nhân sự &amp; tài khoản dùng chung</h2><PcnUserManagementView users={users} roles={roles} fields={fields} currentUser={currentUser as UserAccount} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} onResetPassword={onResetPassword} /></section>
    {canManageWorkflow && <PcnWorkflowTemplateManagementView currentUser={currentUser} workflowTemplates={workflowTemplates} onCreateWorkflowRevision={onCreateWorkflowRevision} onPublishWorkflowTemplate={onPublishWorkflowTemplate} onRetireWorkflowTemplate={onRetireWorkflowTemplate} />}
    <section aria-labelledby="system-pcn-heading" className="space-y-2"><h2 id="system-pcn-heading" className="px-1 text-sm font-black text-slate-900">Cấu hình PCN &amp; Template DOCX PCN</h2><PcnSettingsView currentUser={currentUser as UserAccount} templates={pcnTemplates} onUploadTemplate={onUploadPcnTemplate} onReviewTemplate={onReviewPcnTemplate} /></section>
  </div>;
}
