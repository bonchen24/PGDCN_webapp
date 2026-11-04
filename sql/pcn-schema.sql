-- PCN self-hosted Supabase database schema.
-- This database intentionally contains no DDT relational tables; the app
-- document contract is scoped to this logical database by APP_PROFILE=pcn.

CREATE TABLE IF NOT EXISTS app_documents (
    collection_name VARCHAR(100) NOT NULL,
    document_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_name, document_id)
);

CREATE OR REPLACE FUNCTION prevent_pcn_activity_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.collection_name IN ('activityLogs', 'agentAuditLogs', 'pgdActivityLogs') THEN
        RAISE EXCEPTION 'Activity log nghiệp vụ và audit AI là append-only, không được sửa hoặc xóa.';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pcn_activity_logs_append_only ON app_documents;
CREATE TRIGGER trg_pcn_activity_logs_append_only
BEFORE UPDATE OR DELETE ON app_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_pcn_activity_log_mutation();

CREATE OR REPLACE FUNCTION create_pcn_activity_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    entity_type TEXT;
    activity_action TEXT;
    assignment_targets JSONB;
    notification_data JSONB;
BEGIN
    IF NEW.collection_name <> 'activityLogs' THEN
        RETURN NEW;
    END IF;

    IF COALESCE(UPPER(NEW.data->>'source'), 'UI') IN ('IMPORT', 'RESTORE') THEN
        RETURN NEW;
    END IF;

    entity_type := NEW.data->>'entityType';
    activity_action := COALESCE(NEW.data->>'action', 'UPDATED');
    assignment_targets := '[]'::jsonb;
    IF entity_type = 'PCN_DOSSIER' THEN
        SELECT COALESCE(
            jsonb_agg(DISTINCT LOWER(TRIM(change_item->>'after'))) FILTER (
                WHERE change_item->>'field' IN ('ownerUsername', 'evaluatorUsername', 'reviewerUsername')
                  AND NULLIF(TRIM(change_item->>'after'), '') IS NOT NULL
            ),
            '[]'::jsonb
        )
        INTO assignment_targets
        FROM jsonb_array_elements(COALESCE(NEW.data->'changes', '[]'::jsonb)) AS change_item;
        IF jsonb_array_length(assignment_targets) > 0 THEN
            activity_action := 'ASSIGNED';
        END IF;
    END IF;
    IF entity_type IS NULL OR entity_type NOT IN (
        'PCN_PROPOSAL', 'PCN_DOSSIER', 'PCN_SAMPLE_LOT', 'PCN_LAB_REQUEST',
        'PCN_RESULT', 'PCN_APPROVAL', 'PCN_ISSUANCE'
    ) THEN
        RETURN NEW;
    END IF;

    notification_data := jsonb_strip_nulls(jsonb_build_object(
        'id', 'pcn-notif-' || NEW.document_id,
        'domain', 'PCN',
        'type', 'BUSINESS_ACTIVITY',
        'title', CASE entity_type
            WHEN 'PCN_PROPOSAL' THEN 'Đề nghị PCN mới'
            WHEN 'PCN_DOSSIER' THEN CASE WHEN activity_action = 'ASSIGNED' THEN 'Hồ sơ PCN được phân công' ELSE 'Hồ sơ PCN được cập nhật' END
            WHEN 'PCN_SAMPLE_LOT' THEN 'Lô mẫu PCN được cập nhật'
            WHEN 'PCN_LAB_REQUEST' THEN 'PYC gửi PTN được cập nhật'
            WHEN 'PCN_RESULT' THEN 'KQTN PCN mới'
            WHEN 'PCN_APPROVAL' THEN 'Phê duyệt PCN được cập nhật'
            WHEN 'PCN_ISSUANCE' THEN 'Phát hành PCN được cập nhật'
            ELSE 'Hoạt động PCN'
        END,
        'message', COALESCE(NEW.data->>'summary', 'Có hoạt động mới trong PCN') || ' | Bởi: ' || COALESCE(NEW.data->>'actorName', 'Người dùng hệ thống'),
        'entityType', entity_type,
        'action', activity_action,
        'entityId', NULLIF(NEW.data->>'entityId', ''),
        'entityLabel', COALESCE(NULLIF(NEW.data->>'entityLabel', ''), NULLIF(NEW.data->>'entityId', '')),
        'createdBy', NULLIF(NEW.data->>'actorName', ''),
        'createdAt', COALESCE(NULLIF(NEW.data->>'createdAt', ''), CURRENT_TIMESTAMP::TEXT),
        'read', FALSE,
        'targetRole', CASE WHEN (entity_type = 'PCN_PROPOSAL' AND activity_action = 'CREATED') OR activity_action = 'ASSIGNED' THEN 'staff' ELSE 'admin' END,
        'targetUsernames', CASE WHEN jsonb_array_length(assignment_targets) > 0 THEN assignment_targets ELSE NULL END
    ));

    INSERT INTO app_documents (collection_name, document_id, data, updated_at)
    VALUES ('notifications', notification_data->>'id', notification_data, CURRENT_TIMESTAMP)
    ON CONFLICT (collection_name, document_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pcn_activity_notifications ON app_documents;
CREATE TRIGGER trg_pcn_activity_notifications
AFTER INSERT ON app_documents
FOR EACH ROW
EXECUTE FUNCTION create_pcn_activity_notification();

CREATE TABLE IF NOT EXISTS file_assets (
    id VARCHAR(100) PRIMARY KEY,
    bucket_name VARCHAR(100) NOT NULL,
    object_path TEXT NOT NULL,
    source_collection VARCHAR(100) NOT NULL,
    source_document_id TEXT NOT NULL,
    source_json_path TEXT NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
    sha256 CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (bucket_name, object_path)
);

-- dossierDocuments stores pointer-only document metadata and version history in app_documents;
-- file bytes remain in the private Storage bucket referenced by file_assets.
-- certificationDossiers.data may include operationalForms and documentWaivers
-- JSONB snapshots. These snapshots are written only through the PCN dossier
-- mutation boundary, while signed/confirmed documents remain pointer-only
-- dossierDocuments records. A waiver is an explicit reasoned decision, not a
-- deletion of the requirement or its file history.
-- pcnDraftWorkspaces stores optional-source, independent form drafting state;
-- generated bytes still live in private Storage and are referenced by
-- file_assets with source_collection = 'pcnDraftWorkspaces'. Draft output does
-- not advance or mutate a certificationDossier lifecycle.
-- pcnSampleRequestBundles stores the user-facing aggregate PYC tổng; child
-- labRequests remain the route/PTN integration records and keep their own
-- external request identity.
-- pcnWorkflowTemplates stores manager-authored, versioned topology only;
-- pcnDossierWorkflowTasks stores current node state. Published templates are
-- immutable by server policy, while a dossier keeps its own workflowSnapshot.
-- pgdWorkflowTemplates stores the PGD-owned equivalent. It contains only
-- workflow topology and requirement codes; runtime dossier files stay in
-- pgdDossierDocuments and are never bundled into a template.

CREATE INDEX IF NOT EXISTS idx_pcn_workflow_templates_code_version
    ON app_documents (LOWER(data->>'code'), (data->>'version') DESC, updated_at DESC)
    WHERE collection_name = 'pcnWorkflowTemplates';

CREATE INDEX IF NOT EXISTS idx_pgd_workflow_templates_code_version
    ON app_documents (LOWER(data->>'code'), (data->>'version') DESC, updated_at DESC)
    WHERE collection_name = 'pgdWorkflowTemplates' AND data->>'domain' = 'pgd';

CREATE INDEX IF NOT EXISTS idx_pcn_workflow_tasks_dossier_status
    ON app_documents ((data->>'dossierId'), (data->>'status'), updated_at DESC)
    WHERE collection_name = 'pcnDossierWorkflowTasks';

CREATE INDEX IF NOT EXISTS idx_pcn_sample_request_bundles_customer
    ON app_documents (collection_name, (data->'customerSnapshot'->>'name'))
    WHERE collection_name = 'pcnSampleRequestBundles';

CREATE INDEX IF NOT EXISTS idx_pcn_sample_request_bundles_status
    ON app_documents (collection_name, (data->>'status'), updated_at)
    WHERE collection_name = 'pcnSampleRequestBundles';

INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES
    ('pcnCertificationFields', 'QC4', '{"code":"QC4","name":"Quy chuẩn 4","standardRefs":["QCVN 4:2009/BKHCN"],"active":true}'::jsonb, CURRENT_TIMESTAMP),
    ('pcnCertificationFields', 'QC9', '{"code":"QC9","name":"Quy chuẩn 9","standardRefs":["QCVN 9","TCVN 7492-1:2018"],"active":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT (collection_name, document_id) DO NOTHING;

-- One safe, non-secret settings snapshot is seeded for a fresh PCN database.
-- Admin changes are persisted through /api/pcn/settings and are not overwritten
-- when the schema is applied again.
INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES (
    'systemConfig',
    'pcn-settings',
    '{"id":"pcn-settings","fieldCodes":["QC4","QC9"],"labRoutes":{"QC4":["PERFORMANCE","EMC","ELECTRICAL_SAFETY"],"QC9":["PERFORMANCE","EMC","ELECTRICAL_SAFETY"]},"checklist":{"requireFilesBeforeAdvance":true,"showCompletenessToManagers":true},"coding":{"proposalPrefix":"DN","dossierPrefix":"HS","sampleLotPrefix":"M"},"ocr":{"enabled":true,"provider":"PADDLEOCR","confidenceThreshold":0.75},"storage":{"bucket":"pcn-files","privateOnly":true}}'::jsonb,
    CURRENT_TIMESTAMP
)
ON CONFLICT (collection_name, document_id) DO NOTHING;

-- PCN separates access control from the department position catalogue.
INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES
    ('pcnDepartmentRoles', 'LEADERSHIP', '{"code":"LEADERSHIP","name":"Lãnh đạo phòng","active":true,"sortOrder":10}'::jsonb, CURRENT_TIMESTAMP),
    ('pcnDepartmentRoles', 'CERTIFICATION_EXPERT', '{"code":"CERTIFICATION_EXPERT","name":"Chuyên gia chứng nhận","active":true,"sortOrder":20}'::jsonb, CURRENT_TIMESTAMP),
    ('pcnDepartmentRoles', 'TECHNICAL_REVIEWER', '{"code":"TECHNICAL_REVIEWER","name":"Người soát xét kỹ thuật","active":true,"sortOrder":30}'::jsonb, CURRENT_TIMESTAMP),
    ('pcnDepartmentRoles', 'SAMPLE_COORDINATOR', '{"code":"SAMPLE_COORDINATOR","name":"Điều phối / tiếp nhận mẫu","active":true,"sortOrder":40}'::jsonb, CURRENT_TIMESTAMP),
    ('pcnDepartmentRoles', 'DOCUMENT_CLERK', '{"code":"DOCUMENT_CLERK","name":"Văn thư hồ sơ","active":true,"sortOrder":50}'::jsonb, CURRENT_TIMESTAMP),
    ('pcnDepartmentRoles', 'UNASSIGNED', '{"code":"UNASSIGNED","name":"Chưa phân công","active":true,"sortOrder":99}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT (collection_name, document_id) DO NOTHING;

-- Initial PCN personnel bootstrap. Credentials are
-- intentionally not copied; accounts without a password use the existing
-- first-login default and must be reset by the PCN administrator.
INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES
    ('systemUsers', 'luongxuanhung', '{"username":"luongxuanhung","name":"Lương Xuân Hùng","role":"admin","systemRole":"admin","managementRoleCode":"DEPARTMENT_DEPUTY","professionalRoleCodes":[],"departmentRoleCode":"LEADERSHIP","fieldCodes":[],"departmentScopes":["PCN","PGD"],"pgdRole":"PGD_ADMIN","active":true,"position":"Phó trưởng phòng","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'tranhoangphuong', '{"username":"tranhoangphuong","name":"Trần Hoàng Phương","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'nguyentuanthanh', '{"username":"nguyentuanthanh","name":"Nguyễn Tuấn Thành","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'vuthitham', '{"username":"vuthitham","name":"Vũ Thị Thắm","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'dangducbinh', '{"username":"dangducbinh","name":"Đặng Đức Bình","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'nguyenquocviet', '{"username":"nguyenquocviet","name":"Nguyễn Quốc Việt","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'buithivananh', '{"username":"buithivananh","name":"Bùi Thị Vân Anh","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'dongocminh', '{"username":"dongocminh","name":"Đỗ Ngọc Minh","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'lethanhvinh', '{"username":"lethanhvinh","name":"Lê Thành Vinh","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'nguyenhainam', '{"username":"nguyenhainam","name":"Nguyễn Hải Nam","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'nguyentienthanh', '{"username":"nguyentienthanh","name":"Nguyễn Tiến Thành","role":"admin","systemRole":"admin","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'phamquyphuong', '{"username":"phamquyphuong","name":"Phạm Quý Phương","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'tranthiphuong', '{"username":"tranthiphuong","name":"Trần thị phượng","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Nhân viên PCN","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT (collection_name, document_id) DO NOTHING;

INSERT INTO app_documents (collection_name, document_id, data, updated_at)
SELECT
    'pcnDocumentRequirements',
    item->>'id',
    item - 'id',
    CURRENT_TIMESTAMP
FROM jsonb_array_elements('[
  {"id":"QC4-PROPOSAL","fieldCode":"QC4","code":"PROPOSAL","name":"Đề nghị / đơn đăng ký","stages":["INTAKE"],"stationKeys":["INTAKE","DOCUMENTS"],"required":true,"active":true,"sortOrder":10},
  {"id":"QC4-COMMERCIAL","fieldCode":"QC4","code":"COMMERCIAL","name":"Báo giá / hợp đồng","stages":["INTAKE"],"stationKeys":["INTAKE","DOCUMENTS"],"required":true,"active":true,"sortOrder":20},
  {"id":"QC4-ASSIGNMENT_FORM","fieldCode":"QC4","code":"ASSIGNMENT_FORM","name":"Phiếu phân công chứng nhận","stages":["INTAKE"],"stationKeys":["ASSIGNMENT"],"required":true,"active":true,"sortOrder":25},
  {"id":"QC4-EVALUATION_PLAN","fieldCode":"QC4","code":"EVALUATION_PLAN","name":"Kế hoạch đánh giá CNSP","stages":["INTAKE"],"stationKeys":["EVALUATION"],"required":true,"active":true,"sortOrder":26},
  {"id":"QC4-FIELD_INSPECTION","fieldCode":"QC4","code":"FIELD_INSPECTION","name":"Biên bản kiểm tra tại hiện trường","stages":["INTAKE"],"stationKeys":["EVALUATION"],"required":true,"active":true,"sortOrder":27},
  {"id":"QC4-LAB_REQUEST","fieldCode":"QC4","code":"LAB_REQUEST","name":"PYC gửi phòng thử nghiệm","stages":["LAB_ROUTING"],"stationKeys":["SAMPLING_LAB"],"required":true,"active":true,"sortOrder":30},
  {"id":"QC4-SAMPLE_CODING","fieldCode":"QC4","code":"SAMPLE_CODING","name":"Biên bản mã hóa mẫu","stages":["LAB_ROUTING"],"stationKeys":["SAMPLING_LAB"],"required":true,"active":true,"sortOrder":35},
  {"id":"QC4-SAMPLE_HANDOVER","fieldCode":"QC4","code":"SAMPLE_HANDOVER","name":"Biên bản lấy / giao mẫu","stages":["LAB_ROUTING"],"stationKeys":["SAMPLING_LAB"],"required":true,"active":true,"sortOrder":40},
  {"id":"QC4-TEST_REPORT","fieldCode":"QC4","code":"TEST_REPORT","name":"Báo cáo / KQTN","stages":["TECHNICAL_REVIEW"],"stationKeys":["RESULTS","TECHNICAL_REVIEW"],"required":true,"active":true,"sortOrder":50},
  {"id":"QC4-CERTIFICATION_RESULT","fieldCode":"QC4","code":"CERTIFICATION_RESULT","name":"Kết quả chứng nhận / phụ lục","stages":["TECHNICAL_REVIEW"],"stationKeys":["TECHNICAL_REVIEW"],"required":true,"active":true,"sortOrder":60},
  {"id":"QC4-CERTIFICATE","fieldCode":"QC4","code":"CERTIFICATE","name":"Giấy chứng nhận","stages":["ISSUANCE"],"stationKeys":["APPROVAL","ISSUANCE"],"required":true,"active":true,"sortOrder":70},
  {"id":"QC4-DECISION","fieldCode":"QC4","code":"DECISION","name":"Quyết định","stages":["ISSUANCE"],"stationKeys":["APPROVAL","ISSUANCE"],"required":true,"active":true,"sortOrder":80},
  {"id":"QC4-CLIENT_PACKAGE","fieldCode":"QC4","code":"CLIENT_PACKAGE","name":"Hồ sơ gửi khách hàng","stages":["DELIVERY"],"stationKeys":["DELIVERY_ARCHIVE"],"required":true,"active":true,"sortOrder":90},
  {"id":"QC4-ARCHIVE_SCAN","fieldCode":"QC4","code":"ARCHIVE_SCAN","name":"Bản scan lưu hồ sơ","stages":["ARCHIVE"],"stationKeys":["DELIVERY_ARCHIVE"],"required":true,"active":true,"sortOrder":100},
  {"id":"QC9-PROPOSAL","fieldCode":"QC9","code":"PROPOSAL","name":"Đề nghị / đơn đăng ký","stages":["INTAKE"],"stationKeys":["INTAKE","DOCUMENTS"],"required":true,"active":true,"sortOrder":10},
  {"id":"QC9-COMMERCIAL","fieldCode":"QC9","code":"COMMERCIAL","name":"Báo giá / hợp đồng","stages":["INTAKE"],"stationKeys":["INTAKE","DOCUMENTS"],"required":true,"active":true,"sortOrder":20},
  {"id":"QC9-ASSIGNMENT_FORM","fieldCode":"QC9","code":"ASSIGNMENT_FORM","name":"Phiếu phân công chứng nhận","stages":["INTAKE"],"stationKeys":["ASSIGNMENT"],"required":true,"active":true,"sortOrder":25},
  {"id":"QC9-EVALUATION_PLAN","fieldCode":"QC9","code":"EVALUATION_PLAN","name":"Kế hoạch đánh giá CNSP","stages":["INTAKE"],"stationKeys":["EVALUATION"],"required":true,"active":true,"sortOrder":26},
  {"id":"QC9-FIELD_INSPECTION","fieldCode":"QC9","code":"FIELD_INSPECTION","name":"Biên bản kiểm tra tại hiện trường","stages":["INTAKE"],"stationKeys":["EVALUATION"],"required":true,"active":true,"sortOrder":27},
  {"id":"QC9-LAB_REQUEST","fieldCode":"QC9","code":"LAB_REQUEST","name":"PYC gửi phòng thử nghiệm","stages":["LAB_ROUTING"],"stationKeys":["SAMPLING_LAB"],"required":true,"active":true,"sortOrder":30},
  {"id":"QC9-SAMPLE_CODING","fieldCode":"QC9","code":"SAMPLE_CODING","name":"Biên bản mã hóa mẫu","stages":["LAB_ROUTING"],"stationKeys":["SAMPLING_LAB"],"required":true,"active":true,"sortOrder":35},
  {"id":"QC9-SAMPLE_HANDOVER","fieldCode":"QC9","code":"SAMPLE_HANDOVER","name":"Biên bản giao mẫu","stages":["LAB_ROUTING"],"stationKeys":["SAMPLING_LAB"],"required":true,"active":true,"sortOrder":40},
  {"id":"QC9-SAMPLE_RETURN","fieldCode":"QC9","code":"SAMPLE_RETURN","name":"Biên bản trả mẫu","stages":["LAB_ROUTING"],"stationKeys":["SAMPLING_LAB"],"required":true,"active":true,"sortOrder":50},
  {"id":"QC9-TEST_REPORT","fieldCode":"QC9","code":"TEST_REPORT","name":"KQTN","stages":["TECHNICAL_REVIEW"],"stationKeys":["RESULTS","TECHNICAL_REVIEW"],"required":true,"active":true,"sortOrder":60},
  {"id":"QC9-EXTENSION_LETTER","fieldCode":"QC9","code":"EXTENSION_LETTER","name":"Công văn gia hạn","stages":["TECHNICAL_REVIEW"],"stationKeys":["CORRECTION"],"required":false,"active":true,"sortOrder":70},
  {"id":"QC9-CORRECTIVE_ACTION_LETTER","fieldCode":"QC9","code":"CORRECTIVE_ACTION_LETTER","name":"Công văn khắc phục","stages":["TECHNICAL_REVIEW"],"stationKeys":["CORRECTION"],"required":false,"active":true,"sortOrder":80},
  {"id":"QC9-FAILURE_LETTER","fieldCode":"QC9","code":"FAILURE_LETTER","name":"Công văn không đạt","stages":["TECHNICAL_REVIEW"],"stationKeys":["CORRECTION"],"required":false,"active":true,"sortOrder":90},
  {"id":"QC9-CERTIFICATE","fieldCode":"QC9","code":"CERTIFICATE","name":"Giấy chứng nhận","stages":["ISSUANCE"],"stationKeys":["APPROVAL","ISSUANCE"],"required":true,"active":true,"sortOrder":100},
  {"id":"QC9-DECISION","fieldCode":"QC9","code":"DECISION","name":"Quyết định","stages":["ISSUANCE"],"stationKeys":["APPROVAL","ISSUANCE"],"required":true,"active":true,"sortOrder":110},
  {"id":"QC9-CLIENT_PACKAGE","fieldCode":"QC9","code":"CLIENT_PACKAGE","name":"Hồ sơ gửi khách hàng","stages":["DELIVERY"],"stationKeys":["DELIVERY_ARCHIVE"],"required":true,"active":true,"sortOrder":120},
  {"id":"QC9-ARCHIVE_SCAN","fieldCode":"QC9","code":"ARCHIVE_SCAN","name":"Bản scan lưu hồ sơ","stages":["ARCHIVE"],"stationKeys":["DELIVERY_ARCHIVE"],"required":true,"active":true,"sortOrder":130}
]'::jsonb) AS item
ON CONFLICT (collection_name, document_id) DO UPDATE
SET data = CASE
  WHEN app_documents.data ? 'stationKeys' THEN app_documents.data
  WHEN EXCLUDED.data ? 'stationKeys' THEN app_documents.data || jsonb_build_object('stationKeys', EXCLUDED.data->'stationKeys')
  ELSE app_documents.data
END,
updated_at = app_documents.updated_at;

-- Default PGD workflow: a shared, published starting point for the four
-- product groups. Requirement codes remain references to the PGD checklist;
-- actual files are created only inside a running dossier.
INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES (
    'pgdWorkflowTemplates',
    'pgd-standard-v1',
    $$
    {
      "domain":"pgd",
      "code":"PGD-STANDARD",
      "name":"Lưu trình PGD tiêu chuẩn",
      "description":"Lưu trình mặc định cho hồ sơ giám định; quản lý có thể tạo revision theo nhóm sản phẩm hoặc phương thức.",
      "appliesTo":{"productGroups":["STEEL_METAL","MACHINERY_LINE","COAL","OTHER"],"methodCodes":["TT58","QT-GĐ-14","GENERIC"]},
      "version":1,
      "status":"PUBLISHED",
      "nodes":[
        {"id":"request","kind":"DOCUMENT_TASK","label":"Tiếp nhận PYC","actionKey":"INTAKE","requirementCodes":["REQUEST_PYC","REQUEST_SUPPORTING"],"active":true,"sortOrder":10,"laneId":"intake","column":1},
        {"id":"commercial","kind":"DOCUMENT_TASK","label":"Bổ sung hồ sơ thương mại","actionKey":"DOCUMENTS","requirementCodes":["COMMERCIAL_CONTRACT","COMMERCIAL_INVOICE","PACKING_LIST","BILL_OF_LADING","CUSTOMS_DECLARATION","CERTIFICATE_OF_ORIGIN"],"active":true,"sortOrder":20,"laneId":"intake","column":2},
        {"id":"plan","kind":"DOCUMENT_TASK","label":"Lập kế hoạch giám định","actionKey":"PLAN","requirementCodes":["INSPECTION_PLAN","TECHNICAL_SPECIFICATION","MACHINERY_TECHNICAL_DOSSIER","COAL_TECHNICAL_OVERVIEW","COAL_QUALITY_SPECIFICATION","TECHNICAL_OVERVIEW"],"active":true,"sortOrder":30,"laneId":"preparation","column":3},
        {"id":"field","kind":"DOCUMENT_TASK","label":"Giám định hiện trường","actionKey":"FIELD","requirementCodes":["FIELD_INSPECTION_MINUTES","FIELD_ACTIVITY_LOG","FIELD_SAMPLE_TAKING","MACHINERY_CONDITION_ASSESSMENT","MACHINERY_SYNCHRONIZATION_ASSESSMENT"],"active":true,"sortOrder":40,"laneId":"field","column":4},
        {"id":"lab","kind":"DOCUMENT_TASK","label":"Giao mẫu và tiếp nhận KQTN","actionKey":"LAB_SUBCONTRACTOR","requirementCodes":["SAMPLE_HANDOVER_LAB","LAB_RESULT"],"active":true,"sortOrder":50,"laneId":"lab","column":5},
        {"id":"review","kind":"DOCUMENT_TASK","label":"Rà soát và lập báo cáo","actionKey":"RESULT_ISSUANCE","requirementCodes":["LAB_RESULT_REVIEW","INSPECTION_REPORT"],"active":true,"sortOrder":60,"laneId":"review","column":5},
        {"id":"approval","kind":"APPROVAL_TASK","label":"Phê duyệt chứng thư","actionKey":"APPROVAL","requirementCodes":["DECISION","INSPECTION_CERTIFICATE"],"active":true,"sortOrder":70,"laneId":"review","column":6},
        {"id":"archive","kind":"END","label":"Đóng và lưu trữ","actionKey":"ARCHIVE","requirementCodes":["DOSSIER_COVER","ARCHIVE_INDEX"],"active":true,"sortOrder":80,"laneId":"archive","column":6}
      ],
      "transitions":[
        {"id":"request-commercial","fromNodeId":"request","toNodeId":"commercial","condition":"ALWAYS"},
        {"id":"commercial-plan","fromNodeId":"commercial","toNodeId":"plan","condition":"REQUIRED_DOCUMENTS_COMPLETE"},
        {"id":"plan-field","fromNodeId":"plan","toNodeId":"field","condition":"REQUIRED_DOCUMENTS_COMPLETE"},
        {"id":"field-lab","fromNodeId":"field","toNodeId":"lab","condition":"ALWAYS"},
        {"id":"lab-review","fromNodeId":"lab","toNodeId":"review","condition":"REQUIRED_DOCUMENTS_COMPLETE"},
        {"id":"review-approval","fromNodeId":"review","toNodeId":"approval","condition":"REQUIRED_DOCUMENTS_COMPLETE"},
        {"id":"approval-archive","fromNodeId":"approval","toNodeId":"archive","condition":"ALWAYS"}
      ],
      "createdAt":"2026-09-06T00:00:00.000Z",
      "createdBy":"SYSTEM_SEED",
      "updatedAt":"2026-09-06T00:00:00.000Z",
      "updatedBy":"SYSTEM_SEED",
      "publishedAt":"2026-09-06T00:00:00.000Z",
      "publishedBy":"SYSTEM_SEED"
    }
    $$::jsonb,
    CURRENT_TIMESTAMP
)
ON CONFLICT (collection_name, document_id) DO NOTHING;

-- Default PCN workflow: a versioned, manager-owned topology with one
-- parallel lab/document-review branch. It is intentionally small and can be
-- superseded by a manager revision without changing existing dossier snapshots.
INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES (
    'pcnWorkflowTemplates',
    'pcn-qc-standard-v1',
    '{"code":"QC-STANDARD","name":"Lưu trình PCN tiêu chuẩn","description":"Lưu trình mặc định cho hồ sơ QC mới; các loại hồ sơ khác có thể dùng revision riêng.","appliesTo":{"fieldCodes":[],"methods":["METHOD_1","METHOD_5","METHOD_7"]},"version":1,"status":"PUBLISHED","nodes":[{"id":"intake","kind":"DOCUMENT_TASK","label":"Tiếp nhận Đề nghị","actionKey":"INTAKE","requirementIds":["QC4-PROPOSAL","QC4-COMMERCIAL","QC9-PROPOSAL","QC9-COMMERCIAL"],"active":true,"sortOrder":10,"laneId":"intake","column":1},{"id":"assignment","kind":"APPROVAL_TASK","label":"Phân công hồ sơ","actionKey":"ASSIGNMENT","requirementIds":["QC4-ASSIGNMENT_FORM","QC9-ASSIGNMENT_FORM"],"active":true,"sortOrder":20,"laneId":"preparation","column":2},{"id":"evaluation","kind":"DOCUMENT_TASK","label":"Đánh giá hiện trường","actionKey":"EVALUATION","requirementIds":["QC4-EVALUATION_PLAN","QC4-FIELD_INSPECTION","QC9-EVALUATION_PLAN","QC9-FIELD_INSPECTION"],"active":true,"sortOrder":30,"laneId":"field","column":3},{"id":"split","kind":"PARALLEL_SPLIT","label":"Tách nhánh xử lý","requirementIds":[],"active":true,"sortOrder":40,"laneId":"field","column":3},{"id":"sampling","kind":"DOCUMENT_TASK","label":"Lấy mẫu và gửi PTN","actionKey":"SAMPLING_LAB","requirementIds":["QC4-LAB_REQUEST","QC4-SAMPLE_CODING","QC4-SAMPLE_HANDOVER","QC9-LAB_REQUEST","QC9-SAMPLE_CODING","QC9-SAMPLE_HANDOVER","QC9-SAMPLE_RETURN"],"active":true,"sortOrder":50,"laneId":"lab","column":4},{"id":"review","kind":"DOCUMENT_TASK","label":"Hoàn thiện kết quả","actionKey":"TECHNICAL_REVIEW","requirementIds":["QC4-CERTIFICATION_RESULT","QC9-TEST_REPORT"],"active":true,"sortOrder":60,"laneId":"review","column":4},{"id":"join","kind":"PARALLEL_JOIN","label":"Gom nhánh","joinPolicy":"ALL","requirementIds":[],"active":true,"sortOrder":70,"laneId":"review","column":5},{"id":"approval","kind":"APPROVAL_TASK","label":"Phê duyệt","actionKey":"APPROVAL","requirementIds":["QC4-CERTIFICATE","QC4-DECISION","QC9-CERTIFICATE","QC9-DECISION"],"active":true,"sortOrder":80,"laneId":"review","column":5},{"id":"delivery","kind":"DOCUMENT_TASK","label":"Giao khách hàng","actionKey":"DELIVERY_ARCHIVE","requirementIds":["QC4-CLIENT_PACKAGE","QC9-CLIENT_PACKAGE"],"active":true,"sortOrder":90,"laneId":"archive","column":6},{"id":"archive","kind":"END","label":"Lưu trữ hồ sơ","actionKey":"DELIVERY_ARCHIVE","requirementIds":["QC4-ARCHIVE_SCAN","QC9-ARCHIVE_SCAN"],"active":true,"sortOrder":100,"laneId":"archive","column":6}],"transitions":[{"id":"t-intake-assignment","fromNodeId":"intake","toNodeId":"assignment","condition":"ALWAYS"},{"id":"t-assignment-evaluation","fromNodeId":"assignment","toNodeId":"evaluation","condition":"ALWAYS"},{"id":"t-evaluation-split","fromNodeId":"evaluation","toNodeId":"split","condition":"ALWAYS"},{"id":"t-split-sampling","fromNodeId":"split","toNodeId":"sampling","condition":"ALWAYS"},{"id":"t-split-review","fromNodeId":"split","toNodeId":"review","condition":"ALWAYS"},{"id":"t-sampling-join","fromNodeId":"sampling","toNodeId":"join","condition":"ALWAYS"},{"id":"t-review-join","fromNodeId":"review","toNodeId":"join","condition":"ALWAYS"},{"id":"t-join-approval","fromNodeId":"join","toNodeId":"approval","condition":"ALWAYS"},{"id":"t-approval-delivery","fromNodeId":"approval","toNodeId":"delivery","condition":"ALWAYS"},{"id":"t-delivery-archive","fromNodeId":"delivery","toNodeId":"archive","condition":"ALWAYS"}],"createdAt":"2026-09-06T00:00:00.000Z","createdBy":"SYSTEM_SEED","updatedAt":"2026-09-06T00:00:00.000Z","updatedBy":"SYSTEM_SEED","publishedAt":"2026-09-06T00:00:00.000Z","publishedBy":"SYSTEM_SEED"}'::jsonb,
    CURRENT_TIMESTAMP
)
ON CONFLICT (collection_name, document_id) DO NOTHING;

-- PCN workflow revision 2 splits the work into small, selectable nodes.  The
-- field-specific rows intentionally supersede v1 only for newly created
-- dossiers; existing dossiers keep their captured workflow snapshot.
INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES
(
    'pcnWorkflowTemplates',
    'pcn-qc4-standard-v2',
    $$
    {
      "code": "QC-STANDARD",
      "name": "Lưu trình PCN QC4 tiêu chuẩn",
      "description": "Revision 2 tách nhỏ các bước QC4 để hoàn thiện hồ sơ theo từng node.",
      "appliesTo": {
        "fieldCodes": [
          "QC4"
        ],
        "methods": [
          "METHOD_1",
          "METHOD_5",
          "METHOD_7"
        ]
      },
      "version": 2,
      "status": "PUBLISHED",
      "nodes": [
        {
          "id": "proposal",
          "kind": "DOCUMENT_TASK",
          "label": "Đề nghị",
          "actionKey": "INTAKE",
          "requirementIds": [
            "QC4-PROPOSAL"
          ],
          "active": true,
          "sortOrder": 10,
          "laneId": "intake",
          "column": 1
        },
        {
          "id": "commercial",
          "kind": "DOCUMENT_TASK",
          "label": "Thương mại",
          "actionKey": "INTAKE",
          "requirementIds": [
            "QC4-COMMERCIAL"
          ],
          "active": true,
          "sortOrder": 20,
          "laneId": "intake",
          "column": 1
        },
        {
          "id": "assignment",
          "kind": "APPROVAL_TASK",
          "label": "Phân công",
          "actionKey": "ASSIGNMENT",
          "requirementIds": [
            "QC4-ASSIGNMENT_FORM"
          ],
          "active": true,
          "sortOrder": 30,
          "laneId": "preparation",
          "column": 2
        },
        {
          "id": "evaluation-plan",
          "kind": "DOCUMENT_TASK",
          "label": "Kế hoạch đánh giá",
          "actionKey": "EVALUATION",
          "requirementIds": [
            "QC4-EVALUATION_PLAN"
          ],
          "active": true,
          "sortOrder": 40,
          "laneId": "preparation",
          "column": 2
        },
        {
          "id": "field-inspection",
          "kind": "DOCUMENT_TASK",
          "label": "Kiểm tra hiện trường",
          "actionKey": "EVALUATION",
          "requirementIds": [
            "QC4-FIELD_INSPECTION"
          ],
          "active": true,
          "sortOrder": 50,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "pyc",
          "kind": "DOCUMENT_TASK",
          "label": "PYC",
          "actionKey": "SAMPLING_LAB",
          "requirementIds": [
            "QC4-LAB_REQUEST"
          ],
          "active": true,
          "sortOrder": 60,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "sample-coding",
          "kind": "DOCUMENT_TASK",
          "label": "Mã hóa mẫu",
          "actionKey": "SAMPLE_CODING",
          "requirementIds": [
            "QC4-SAMPLE_CODING"
          ],
          "active": true,
          "sortOrder": 70,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "sample-handover",
          "kind": "DOCUMENT_TASK",
          "label": "Giao mẫu",
          "actionKey": "SAMPLE_HANDOVER",
          "requirementIds": [
            "QC4-SAMPLE_HANDOVER"
          ],
          "active": true,
          "sortOrder": 80,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "receive-test-result",
          "kind": "DOCUMENT_TASK",
          "label": "Tiếp nhận KQTN",
          "actionKey": "TEST_REPORT",
          "requirementIds": [
            "QC4-TEST_REPORT"
          ],
          "active": true,
          "sortOrder": 90,
          "laneId": "lab",
          "column": 4
        },
        {
          "id": "complete-result",
          "kind": "DOCUMENT_TASK",
          "label": "Hoàn thiện kết quả",
          "actionKey": "TECHNICAL_REVIEW",
          "requirementIds": [
            "QC4-CERTIFICATION_RESULT"
          ],
          "active": true,
          "sortOrder": 100,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "certificate",
          "kind": "DOCUMENT_TASK",
          "label": "Chứng thư",
          "requirementIds": [
            "QC4-CERTIFICATE"
          ],
          "active": true,
          "sortOrder": 110,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "decision",
          "kind": "DOCUMENT_TASK",
          "label": "Quyết định",
          "requirementIds": [
            "QC4-DECISION"
          ],
          "active": true,
          "sortOrder": 120,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "approval",
          "kind": "APPROVAL_TASK",
          "label": "Phê duyệt",
          "actionKey": "APPROVAL",
          "requirementIds": [],
          "active": true,
          "sortOrder": 130,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "deliver",
          "kind": "DOCUMENT_TASK",
          "label": "Giao khách hàng",
          "actionKey": "DELIVERY",
          "requirementIds": [],
          "active": true,
          "sortOrder": 140,
          "laneId": "archive",
          "column": 6
        },
        {
          "id": "archive",
          "kind": "END",
          "label": "Lưu trữ",
          "actionKey": "ARCHIVE",
          "requirementIds": [],
          "active": true,
          "sortOrder": 150,
          "laneId": "archive",
          "column": 6
        }
      ],
      "transitions": [
        {
          "id": "proposal-commercial",
          "fromNodeId": "proposal",
          "toNodeId": "commercial",
          "condition": "ALWAYS"
        },
        {
          "id": "commercial-assignment",
          "fromNodeId": "commercial",
          "toNodeId": "assignment",
          "condition": "ALWAYS"
        },
        {
          "id": "assignment-evaluation-plan",
          "fromNodeId": "assignment",
          "toNodeId": "evaluation-plan",
          "condition": "ALWAYS"
        },
        {
          "id": "evaluation-plan-field-inspection",
          "fromNodeId": "evaluation-plan",
          "toNodeId": "field-inspection",
          "condition": "ALWAYS"
        },
        {
          "id": "field-inspection-pyc",
          "fromNodeId": "field-inspection",
          "toNodeId": "pyc",
          "condition": "ALWAYS"
        },
        {
          "id": "pyc-sample-coding",
          "fromNodeId": "pyc",
          "toNodeId": "sample-coding",
          "condition": "ALWAYS"
        },
        {
          "id": "sample-coding-sample-handover",
          "fromNodeId": "sample-coding",
          "toNodeId": "sample-handover",
          "condition": "ALWAYS"
        },
        {
          "id": "sample-handover-receive-test-result",
          "fromNodeId": "sample-handover",
          "toNodeId": "receive-test-result",
          "condition": "ALWAYS"
        },
        {
          "id": "receive-test-result-complete-result",
          "fromNodeId": "receive-test-result",
          "toNodeId": "complete-result",
          "condition": "ALWAYS"
        },
        {
          "id": "complete-result-certificate",
          "fromNodeId": "complete-result",
          "toNodeId": "certificate",
          "condition": "ALWAYS"
        },
        {
          "id": "certificate-decision",
          "fromNodeId": "certificate",
          "toNodeId": "decision",
          "condition": "ALWAYS"
        },
        {
          "id": "decision-approval",
          "fromNodeId": "decision",
          "toNodeId": "approval",
          "condition": "ALWAYS"
        },
        {
          "id": "approval-deliver",
          "fromNodeId": "approval",
          "toNodeId": "deliver",
          "condition": "ALWAYS"
        },
        {
          "id": "deliver-archive",
          "fromNodeId": "deliver",
          "toNodeId": "archive",
          "condition": "ALWAYS"
        }
      ],
      "createdAt": "2026-09-06T00:00:00.000Z",
      "createdBy": "SYSTEM_SEED",
      "updatedAt": "2026-09-06T00:00:00.000Z",
      "updatedBy": "SYSTEM_SEED",
      "publishedAt": "2026-09-06T00:00:00.000Z",
      "publishedBy": "SYSTEM_SEED"
    }
    $$::jsonb,
    CURRENT_TIMESTAMP
),
(
    'pcnWorkflowTemplates',
    'pcn-qc9-standard-v2',
    $$
    {
      "code": "QC-STANDARD",
      "name": "Lưu trình PCN QC9 tiêu chuẩn",
      "description": "Revision 2 tách nhỏ các bước QC9 để hoàn thiện hồ sơ theo từng node.",
      "appliesTo": {
        "fieldCodes": [
          "QC9"
        ],
        "methods": [
          "METHOD_1",
          "METHOD_5",
          "METHOD_7"
        ]
      },
      "version": 2,
      "status": "PUBLISHED",
      "nodes": [
        {
          "id": "proposal",
          "kind": "DOCUMENT_TASK",
          "label": "Đề nghị",
          "actionKey": "INTAKE",
          "requirementIds": [
            "QC9-PROPOSAL"
          ],
          "active": true,
          "sortOrder": 10,
          "laneId": "intake",
          "column": 1
        },
        {
          "id": "commercial",
          "kind": "DOCUMENT_TASK",
          "label": "Thương mại",
          "actionKey": "INTAKE",
          "requirementIds": [
            "QC9-COMMERCIAL"
          ],
          "active": true,
          "sortOrder": 20,
          "laneId": "intake",
          "column": 1
        },
        {
          "id": "assignment",
          "kind": "APPROVAL_TASK",
          "label": "Phân công",
          "actionKey": "ASSIGNMENT",
          "requirementIds": [
            "QC9-ASSIGNMENT_FORM"
          ],
          "active": true,
          "sortOrder": 30,
          "laneId": "preparation",
          "column": 2
        },
        {
          "id": "evaluation-plan",
          "kind": "DOCUMENT_TASK",
          "label": "Kế hoạch đánh giá",
          "actionKey": "EVALUATION",
          "requirementIds": [
            "QC9-EVALUATION_PLAN"
          ],
          "active": true,
          "sortOrder": 40,
          "laneId": "preparation",
          "column": 2
        },
        {
          "id": "field-inspection",
          "kind": "DOCUMENT_TASK",
          "label": "Kiểm tra hiện trường",
          "actionKey": "EVALUATION",
          "requirementIds": [
            "QC9-FIELD_INSPECTION"
          ],
          "active": true,
          "sortOrder": 50,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "pyc",
          "kind": "DOCUMENT_TASK",
          "label": "PYC",
          "actionKey": "SAMPLING_LAB",
          "requirementIds": [
            "QC9-LAB_REQUEST"
          ],
          "active": true,
          "sortOrder": 60,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "sample-coding",
          "kind": "DOCUMENT_TASK",
          "label": "Mã hóa mẫu",
          "actionKey": "SAMPLE_CODING",
          "requirementIds": [
            "QC9-SAMPLE_CODING"
          ],
          "active": true,
          "sortOrder": 70,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "sample-handover",
          "kind": "DOCUMENT_TASK",
          "label": "Giao mẫu",
          "actionKey": "SAMPLE_HANDOVER",
          "requirementIds": [
            "QC9-SAMPLE_HANDOVER"
          ],
          "active": true,
          "sortOrder": 80,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "sample-return",
          "kind": "DOCUMENT_TASK",
          "label": "Trả mẫu",
          "actionKey": "SAMPLE_RETURN",
          "requirementIds": [
            "QC9-SAMPLE_RETURN"
          ],
          "active": true,
          "sortOrder": 90,
          "laneId": "field",
          "column": 3
        },
        {
          "id": "receive-test-result",
          "kind": "DOCUMENT_TASK",
          "label": "Tiếp nhận KQTN",
          "actionKey": "TEST_REPORT",
          "requirementIds": [
            "QC9-TEST_REPORT"
          ],
          "active": true,
          "sortOrder": 100,
          "laneId": "lab",
          "column": 4
        },
        {
          "id": "complete-result",
          "kind": "DOCUMENT_TASK",
          "label": "Hoàn thiện kết quả",
          "actionKey": "TECHNICAL_REVIEW",
          "requirementIds": [],
          "active": true,
          "sortOrder": 110,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "certificate",
          "kind": "DOCUMENT_TASK",
          "label": "Chứng thư",
          "requirementIds": [
            "QC9-CERTIFICATE"
          ],
          "active": true,
          "sortOrder": 120,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "decision",
          "kind": "DOCUMENT_TASK",
          "label": "Quyết định",
          "requirementIds": [
            "QC9-DECISION"
          ],
          "active": true,
          "sortOrder": 130,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "approval",
          "kind": "APPROVAL_TASK",
          "label": "Phê duyệt",
          "actionKey": "APPROVAL",
          "requirementIds": [],
          "active": true,
          "sortOrder": 140,
          "laneId": "review",
          "column": 5
        },
        {
          "id": "deliver",
          "kind": "DOCUMENT_TASK",
          "label": "Giao khách hàng",
          "actionKey": "DELIVERY",
          "requirementIds": [],
          "active": true,
          "sortOrder": 150,
          "laneId": "archive",
          "column": 6
        },
        {
          "id": "archive",
          "kind": "END",
          "label": "Lưu trữ",
          "actionKey": "ARCHIVE",
          "requirementIds": [],
          "active": true,
          "sortOrder": 160,
          "laneId": "archive",
          "column": 6
        }
      ],
      "transitions": [
        {
          "id": "proposal-commercial",
          "fromNodeId": "proposal",
          "toNodeId": "commercial",
          "condition": "ALWAYS"
        },
        {
          "id": "commercial-assignment",
          "fromNodeId": "commercial",
          "toNodeId": "assignment",
          "condition": "ALWAYS"
        },
        {
          "id": "assignment-evaluation-plan",
          "fromNodeId": "assignment",
          "toNodeId": "evaluation-plan",
          "condition": "ALWAYS"
        },
        {
          "id": "evaluation-plan-field-inspection",
          "fromNodeId": "evaluation-plan",
          "toNodeId": "field-inspection",
          "condition": "ALWAYS"
        },
        {
          "id": "field-inspection-pyc",
          "fromNodeId": "field-inspection",
          "toNodeId": "pyc",
          "condition": "ALWAYS"
        },
        {
          "id": "pyc-sample-coding",
          "fromNodeId": "pyc",
          "toNodeId": "sample-coding",
          "condition": "ALWAYS"
        },
        {
          "id": "sample-coding-sample-handover",
          "fromNodeId": "sample-coding",
          "toNodeId": "sample-handover",
          "condition": "ALWAYS"
        },
        {
          "id": "sample-handover-sample-return",
          "fromNodeId": "sample-handover",
          "toNodeId": "sample-return",
          "condition": "ALWAYS"
        },
        {
          "id": "sample-return-receive-test-result",
          "fromNodeId": "sample-return",
          "toNodeId": "receive-test-result",
          "condition": "ALWAYS"
        },
        {
          "id": "receive-test-result-complete-result",
          "fromNodeId": "receive-test-result",
          "toNodeId": "complete-result",
          "condition": "ALWAYS"
        },
        {
          "id": "complete-result-certificate",
          "fromNodeId": "complete-result",
          "toNodeId": "certificate",
          "condition": "ALWAYS"
        },
        {
          "id": "certificate-decision",
          "fromNodeId": "certificate",
          "toNodeId": "decision",
          "condition": "ALWAYS"
        },
        {
          "id": "decision-approval",
          "fromNodeId": "decision",
          "toNodeId": "approval",
          "condition": "ALWAYS"
        },
        {
          "id": "approval-deliver",
          "fromNodeId": "approval",
          "toNodeId": "deliver",
          "condition": "ALWAYS"
        },
        {
          "id": "deliver-archive",
          "fromNodeId": "deliver",
          "toNodeId": "archive",
          "condition": "ALWAYS"
        }
      ],
      "createdAt": "2026-09-06T00:00:00.000Z",
      "createdBy": "SYSTEM_SEED",
      "updatedAt": "2026-09-06T00:00:00.000Z",
      "updatedBy": "SYSTEM_SEED",
      "publishedAt": "2026-09-06T00:00:00.000Z",
      "publishedBy": "SYSTEM_SEED"
    }
    $$::jsonb,
    CURRENT_TIMESTAMP
)
ON CONFLICT (collection_name, document_id) DO NOTHING;

-- PGD owns an independent catalog and result-template snapshots for
-- stainless-steel inspection. PCN has no stainless-steel field.
INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES
    ('pgdCatalog', 'STEEL_LOT_INSPECTION', '{"id":"STEEL_LOT_INSPECTION","domain":"pgd","code":"GĐ-THEP-KG","name":"Giám định thép không gỉ","productGroup":"STEEL_METAL","groupCode":"QC20","inspectionTypes":["VISUAL_DIMENSIONAL","QUANTITY_WEIGHT","CHEMICAL","MECHANICAL"],"methodOptions":[{"code":"TT58","name":"Thông tư 58 - giám định thép"},{"code":"QT-GĐ-02","name":"Giám định số lượng"},{"code":"QT-GĐ-03","name":"Giám định khối lượng qua cân"},{"code":"QT-GĐ-04","name":"Giám định quy cách / phẩm chất hàng hóa"},{"code":"QT-GĐ-06","name":"Giám định xuất xứ"},{"code":"QT-GĐ-10","name":"Giám định vật liệu kim loại"},{"code":"QT-GĐ-14","name":"Giám định chất lượng thép theo TTLT 58/2015"}],"defaultStandards":["QCVN 20:2019/BKHCN","Sửa đổi 1:2021 QCVN 20:2019/BKHCN","JIS","ASTM","GB/T"],"slaLabel":"5–7 ngày","active":true}'::jsonb, CURRENT_TIMESTAMP),
    ('pgdCatalog', 'MACHINERY_LINE_INSPECTION', '{"id":"MACHINERY_LINE_INSPECTION","domain":"pgd","code":"GĐ-MAY-01","name":"Giám định máy móc và dây chuyền","productGroup":"MACHINERY_LINE","inspectionTypes":["VISUAL_DIMENSIONAL","MECHANICAL","FIELD_ASSESSMENT"],"methodOptions":[{"code":"QT-GĐ-04","name":"Giám định quy cách / phẩm chất hàng hóa"},{"code":"QT-GĐ-05","name":"Giám định tình trạng"},{"code":"QT-GĐ-06","name":"Giám định xuất xứ"},{"code":"QT-GĐ-07","name":"Giám định tình trạng máy móc đã qua sử dụng"},{"code":"QT-GĐ-09","name":"Giám định máy móc thiết bị"},{"code":"QT-GĐ-12","name":"Giám định tính đồng bộ dây chuyền / máy móc"}],"defaultStandards":["Hồ sơ kỹ thuật","Tiêu chuẩn hợp đồng"],"slaLabel":"3–5 ngày","active":true}'::jsonb, CURRENT_TIMESTAMP),
    ('pgdCatalog', 'COAL_LOT_INSPECTION', '{"id":"COAL_LOT_INSPECTION","domain":"pgd","code":"GĐ-THAN-01","name":"Giám định lô than","productGroup":"COAL","inspectionTypes":["VISUAL_DIMENSIONAL","QUANTITY_WEIGHT","CHEMICAL"],"methodOptions":[{"code":"QT-GĐ-02","name":"Giám định số lượng"},{"code":"QT-GĐ-03","name":"Giám định khối lượng qua cân"},{"code":"QT-GĐ-04","name":"Giám định quy cách / phẩm chất hàng hóa"},{"code":"QT-GĐ-08","name":"Giám định than"}],"defaultStandards":["TCVN 8910","Tiêu chuẩn hợp đồng"],"slaLabel":"Theo kế hoạch","active":true}'::jsonb, CURRENT_TIMESTAMP),
    ('pgdResultTemplates', 'pgd-template-steel-v1', '{"id":"pgd-template-steel-v1","domain":"pgd","catalogId":"STEEL_LOT_INSPECTION","code":"PGD-THEP-01","name":"Biên bản và chứng thư giám định thép không gỉ","version":"1","productGroup":"STEEL_METAL","active":true,"fields":[{"key":"productForm","label":"Dạng sản phẩm","type":"TEXT","required":true},{"key":"grade","label":"Mác thép","type":"TEXT","required":true},{"key":"dimensions","label":"Kích thước","type":"TEXT","required":true},{"key":"conformityConclusion","label":"Kết luận giám định","type":"TEXT","required":true},{"key":"quantityVerified","label":"Khối lượng / số lượng xác nhận","type":"NUMBER","required":true},{"key":"standardReference","label":"Tiêu chuẩn áp dụng","type":"TEXT","required":true}]}'::jsonb, CURRENT_TIMESTAMP),
    ('pgdResultTemplates', 'pgd-template-machinery-v1', '{"id":"pgd-template-machinery-v1","domain":"pgd","catalogId":"MACHINERY_LINE_INSPECTION","code":"PGD-MAY-01","name":"Biên bản và chứng thư giám định máy móc, dây chuyền","version":"1","productGroup":"MACHINERY_LINE","active":true,"fields":[{"key":"condition","label":"Tình trạng thiết bị","type":"TEXT","required":true},{"key":"serialNumbers","label":"Số serial / nhận dạng","type":"TEXT","required":true},{"key":"conformityConclusion","label":"Kết luận giám định","type":"TEXT","required":true}]}'::jsonb, CURRENT_TIMESTAMP),
    ('pgdResultTemplates', 'pgd-template-coal-v1', '{"id":"pgd-template-coal-v1","domain":"pgd","catalogId":"COAL_LOT_INSPECTION","code":"PGD-THAN-01","name":"Biên bản và chứng thư giám định lô than","version":"1","productGroup":"COAL","active":true,"fields":[{"key":"qualityParameters","label":"Thông số chất lượng","type":"TABLE","required":true},{"key":"quantityVerified","label":"Khối lượng / số lượng xác nhận","type":"NUMBER","required":true},{"key":"conformityConclusion","label":"Kết luận giám định","type":"TEXT","required":true}]}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT (collection_name, document_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_pcn_app_documents_collection_updated
ON app_documents(collection_name, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pcn_app_documents_activity_created
ON app_documents ((data->>'createdAt') DESC, document_id DESC)
WHERE collection_name = 'activityLogs';

CREATE INDEX IF NOT EXISTS idx_pcn_agent_audit_timestamp
ON app_documents ((data->>'timestamp') DESC, document_id DESC)
WHERE collection_name = 'agentAuditLogs';

CREATE INDEX IF NOT EXISTS idx_pcn_agent_tasks_assignee_status
ON app_documents (LOWER(data->>'assigneeUsername'), (data->>'status'))
WHERE collection_name = 'pcnTasks';

-- Proposal codes are server-owned business identifiers. Keep retries and
-- concurrent intake requests from creating duplicates that differ by case.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_certification_proposals_proposal_code_ci
ON app_documents (LOWER(data->>'proposalCode'))
WHERE collection_name = 'certificationProposals' AND NULLIF(data->>'proposalCode', '') IS NOT NULL;

-- A lot code is a business identifier, not just a UI label. Keep retries and
-- concurrent requests from creating two lots that differ only by casing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_sample_lots_lot_code_ci
ON app_documents (LOWER(data->>'lotCode'))
WHERE collection_name = 'pcnSampleLots' AND NULLIF(data->>'lotCode', '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcn_sample_items_lot
ON app_documents ((data->>'sampleLotId'), updated_at DESC)
WHERE collection_name = 'pcnSampleItems' AND NULLIF(data->>'sampleLotId', '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_lab_requests_pyc_number_ci
ON app_documents (LOWER(data->>'pycNumber'))
WHERE collection_name = 'labRequests' AND NULLIF(data->>'pycNumber', '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_lab_requests_sample_route
ON app_documents ((data->>'sampleRouteId'))
WHERE collection_name = 'labRequests' AND NULLIF(data->>'sampleRouteId', '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcn_file_assets_source
ON file_assets (source_collection, source_document_id);
