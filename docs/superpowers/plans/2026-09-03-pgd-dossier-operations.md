# PGD Dossier Operations Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

Goal: Biến nhánh PGD thành workspace tạo và quản lý hồ sơ giám định mới với một chủ hồ sơ xuyên suốt, bộ hồ sơ nghiệp vụ, biểu mẫu DOCX placeholder, liên kết bản sinh và gói trình lãnh đạo.

Architecture: Giữ domain/collection PGD hiện có và thêm ownership/package boundary chuyên biệt. PgdInspectionRequest là aggregate root; checklist, generated documents và package manifest chỉ tham chiếu request PGD và được kiểm tra server-side. Card hồ sơ là mutation surface duy nhất; dashboard/register chỉ mở card.

Tech Stack: Next.js 14, React/TypeScript, Express, PostgreSQL app_documents, Zustand, DOCX/PDF renderer hiện có, adm-zip, Node test runner.

Spec: docs/superpowers/specs/2026-09-03-pgd-dossier-operations-design.md và mục 0A.9 trong design.md.

## Global Constraints

- PGD chỉ xử lý hồ sơ mới; runtime không scan, watcher, resolve, import hoặc đồng bộ Desktop/UNC.
- PgdInspectionRequest, PgdDossierDocument và PgdGeneratedDocument không dùng collection/type PCN.
- Chủ hồ sơ là ownerUsername; Admin/Quản lý PGD được gán lại; đoàn giám định/người soát xét là vai trò phối hợp.
- DOCX layout là nguồn bố cục; placeholder [[key]] và metadata cell là hợp đồng form; bảng không nhập JSON thô.
- Không thêm báo giá/thanh toán vào domain, UI, package hoặc checklist PGD.
- File bytes chỉ qua private Storage/file asset; JSONB chỉ giữ pointer, checksum, snapshot và metadata.
- Không stage/commit dist sinh tự động, attachment, backup, tmp hoặc kế hoạch nội bộ ngoài plan/spec được chọn.

---

### Task 1: Ownership và bộ hồ sơ PGD chuẩn hóa

Files:
- Modify: utils/pgdDomain.ts
- Modify: utils/pgdDossier.ts
- Create: utils/pgdDossierPackage.ts
- Modify: store-pgd.ts
- Test: test/pgd-dossier-operations.test.ts

Interfaces:
- PgdInspectionRequest.ownerUsername?: string và ownerAssignedAt?: string.
- assignPgdDossierOwner(request, ownerUsername, assignedAt): PgdInspectionRequest.
- getPgdDossierRequirementForTemplate(kind): PgdDossierRequirement | undefined.
- PgdDossierPackageEntry, PgdDossierPackageManifest và buildPgdDossierPackageManifest(input).

- [ ] Step 1: Viết test domain thất bại trước cho gán owner, mapping INSPECTION_MINUTES → FIELD_INSPECTION_MINUTES và từ chối pointer domain pcn.
- [ ] Step 2: Chạy node --test test/pgd-dossier-operations.test.ts; phải thấy FAIL vì contract chưa tồn tại.
- [ ] Step 3: Thêm owner fields; normalize trong createPgdInspectionRequest. Helper phải trim username, bắt buộc giá trị, giữ nguyên lifecycle/links và chỉ cập nhật thời điểm gán.
- [ ] Step 4: Thêm các requirement optional ASSIGNMENT_FORM, CASE_TIMELINE, FIELD_ACTIVITY_LOG, LAB_RESULT_REVIEW; mapping đủ toàn bộ template kinds hiện có và routing đúng station.
- [ ] Step 5: Tạo pgdDossierPackage.ts. Entry phải domain pgd, source collection PGD, request id, archive path tương đối dưới documents/, checksum và version; deduplicate assetId; báo missingAssetIds/complete=false khi thiếu asset; từ chối absolute path và metadata source-folder.
- [ ] Step 6: Chạy lại test focused, sau đó commit:

    git add utils/pgdDomain.ts utils/pgdDossier.ts utils/pgdDossierPackage.ts store-pgd.ts test/pgd-dossier-operations.test.ts
    git commit -m "feat: add PGD dossier ownership and package contract"

### Task 2: Server ownership, generated-document attachment và package API

Files:
- Modify: server.ts
- Modify: utils/pgdApi.ts
- Modify: store-pgd.ts
- Test: test/pgd-dossier-operations-api.test.ts

Interfaces:
- POST /api/pgd/requests tự gán actor hiện tại khi không có owner.
- PUT /api/pgd/requests/:requestId/owner nhận ownerUsername và chỉ cho PGD Admin/Manager.
- POST /api/pgd/documents/:documentId/attach nhận requirementCode.
- GET /api/pgd/requests/:requestId/package trả ZIP private hoặc 409 kèm missingAssetIds.
- Client methods assignPgdOwner, attachPgdGeneratedDocument, downloadPgdDossierPackage.

- [ ] Step 1: Viết API tests cho auto-owner, reassignment, attach đúng requirement, package, viewer/PCN-only denial, cross-product requirement và non-PGD pointer.
- [ ] Step 2: Chạy node --test test/pgd-dossier-operations-api.test.ts; phải FAIL vì route/client chưa có.
- [ ] Step 3: Trong transaction tạo request, lấy actor từ session server; staff không được tin owner từ browser; set ownerUsername/ownerAssignedAt bằng server time và giữ idempotency.
- [ ] Step 4: Thêm owner route. Lock request; require PGD Admin/Manager; validate target active và có scope PGD; giữ status/links; audit một event ASSIGNED chỉ với identity an toàn.
- [ ] Step 5: Thêm attach route. Lock document/request; xác thực cùng request, domain pgd, requirement thuộc productGroup; áp station/ownership; tạo PgdDossierDocument version mới với sourceCollection pgdDocuments, sourceDocumentId, checksum, asset id và supersedes link, không xóa lịch sử.
- [ ] Step 6: Thêm package route. Thu thập pointer PGD hiện hành, validate bằng package utility, chỉ tải asset private khớp bucket/path/checksum, thêm manifest.json và file vào AdmZip; thiếu asset trả 409; không đọc Desktop/UNC.
- [ ] Step 7: Thêm client/store methods, thay projection request/document sau mutation và tải ZIP bằng blob/anchor với tên file từ server.
- [ ] Step 8: Chạy test focused và commit:

    git add server.ts utils/pgdApi.ts store-pgd.ts test/pgd-dossier-operations-api.test.ts
    git commit -m "feat: add PGD owner and dossier package APIs"

### Task 3: Card hồ sơ và bộ hồ sơ thao tác trong PGD UI

Files:
- Create: components/PgdDossierPanel.tsx
- Modify: components/PgdWorkspace.tsx
- Modify: components/PgdDocumentGenerationPanel.tsx
- Modify: components/PgdSidebar.tsx
- Test: test/pgd-dossier-operations-ui.test.ts

Interfaces:
- PgdDossierPanel({ request, requirements, dossierDocuments, generatedDocuments, currentUser, canMutate, editable, onOpenDocumentGeneration, onDownloadPackage }).
- PgdDocumentGenerationPanel gains onAttachGenerated?(documentId, requirementCode).

- [ ] Step 1: Viết UI tests cho các nhãn Chủ hồ sơ, Bộ hồ sơ PGD, Sinh và đưa vào bộ hồ sơ, Đóng gói trình lãnh đạo; đồng thời cấm Desktop, UNC, folder checker, quét thư mục và source-path input.
- [ ] Step 2: Chạy node --test test/pgd-dossier-operations-ui.test.ts; phải FAIL vì panel/owner chưa có.
- [ ] Step 3: Tạo PgdDossierPanel hiển thị nhóm checklist, status, version, số/ngày chứng từ, nguồn bản sinh/upload, lineage, owner summary, reassignment cho Admin/Manager, package action và missing-asset alert.
- [ ] Step 4: Mount panel làm bề mặt Tài liệu trong bộ hồ sơ PGD ở request detail; giữ sample register/field evidence là panel nghiệp vụ; PgdSourceFormsPanel chỉ là form entry, không phải source inspector.
- [ ] Step 5: Hiển thị owner trên request card; Admin/Manager chọn user PGD đang active và lưu; label team thành Đoàn giám định / phối hợp.
- [ ] Step 6: Trong document generator, derive requirement mặc định từ template kind, giới hạn override theo requirements của hồ sơ, sinh DOCX/PDF rồi attach pointer mà không rời card.
- [ ] Step 7: Package button tải ZIP; giữ card mở khi 409; sau TECHNICAL_REVIEW/LEADERSHIP_APPROVAL hiển thị Bộ hồ sơ trình lãnh đạo — chỉ đọc và khóa mutation.
- [ ] Step 8: Chạy test focused và commit:

    git add components/PgdDossierPanel.tsx components/PgdWorkspace.tsx components/PgdDocumentGenerationPanel.tsx components/PgdSidebar.tsx test/pgd-dossier-operations-ui.test.ts
    git commit -m "feat: make PGD dossier card the workflow surface"

### Task 4: Form catalog completeness và document lineage

Files:
- Modify: utils/pgdDocumentTemplates.ts
- Modify: utils/pgdDocumentGeneration.ts
- Modify: scripts/generate-pgd-docx-templates.ts
- Modify: templates/pgd/manifest.json
- Modify: templates/pgd/PGD-BM-*.docx
- Test: test/pgd-document-generation.test.ts
- Test: test/pgd-document-templates.test.ts

- [ ] Step 1: Viết tests bảo đảm 15 template kinds đều có requirement, owner prefill có trong context, table cells vẫn là row objects, metadata không có Desktop/UNC/sourcePath/raw bytes.
- [ ] Step 2: Chạy node --test test/pgd-document-generation.test.ts test/pgd-document-templates.test.ts; phải FAIL với lineage owner/requirement còn thiếu.
- [ ] Step 3: Thêm owner cells cho INTAKE_REQUEST, ASSIGNMENT, DOSSIER_COVER, INSPECTION_REPORT, DECISION, INSPECTION_CERTIFICATE và bind request owner snapshot.
- [ ] Step 4: Regenerate DOCX pack, cập nhật manifest version, kiểm tra mọi DOCX có placeholder khai báo và đúng tên phòng.
- [ ] Step 5: Chạy focused tests và commit:

    git add utils/pgdDocumentTemplates.ts utils/pgdDocumentGeneration.ts scripts/generate-pgd-docx-templates.ts templates/pgd test/pgd-document-generation.test.ts test/pgd-document-templates.test.ts
    git commit -m "feat: bind PGD forms to dossier ownership lineage"

### Task 5: Full verification, runtime smoke và Docker production

Files:
- Modify: PROJECT_MEMORY.md với bằng chứng thực tế.
- Test: active test suite và runtime smoke output.

- [ ] Step 1: Chạy npm test; expected fail 0.
- [ ] Step 2: Chạy npm run lint, git diff --check và npm run build; tất cả exit 0, Next liệt kê /pgdcn, /pgdcn/pcn, /pgdcn/pgd.
- [ ] Step 3: Runtime smoke request mới, auto-owner, checklist app-generated, attach generated DOCX, viewer denial và package success/missing-asset 409; xác nhận PGD không đọc Desktop/UNC.
- [ ] Step 4: Rebuild production:

    docker compose --env-file .env -f docker-compose.pcn.yml up --build -d
    docker ps --filter name=pcn_webapp-webapp
    docker image inspect pcn_webapp-webapp:latest --format "{{.Id}}|{{index .RepoDigests 0}}"

- [ ] Step 5: Smoke /api/health, /pgdcn/pcn, /pgdcn/pgd; cả ba phải HTTP 200.
- [ ] Step 6: Ghi vào PROJECT_MEMORY.md đúng test count, commit id, image digest, container/port và cảnh báo Storage; không claim package success nếu thiếu asset private.
- [ ] Step 7: Chạy git status --short; xác nhận chỉ artifact ngoài scope còn dirty và báo bằng chứng chính xác.
