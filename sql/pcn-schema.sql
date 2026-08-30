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
    IF OLD.collection_name IN ('activityLogs', 'agentAuditLogs') THEN
        RAISE EXCEPTION 'Activity log nghiệp vụ và audit AI PCN là append-only, không được sửa hoặc xóa.';
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

INSERT INTO app_documents (collection_name, document_id, data, updated_at)
VALUES
    ('pcnCertificationFields', 'QC4', '{"code":"QC4","name":"Quy chuẩn 4","standardRefs":["QCVN 4:2009/BKHCN"],"active":true}'::jsonb, CURRENT_TIMESTAMP),
    ('pcnCertificationFields', 'QC9', '{"code":"QC9","name":"Quy chuẩn 9","standardRefs":["QCVN 9","TCVN 7492-1:2018"],"active":true}'::jsonb, CURRENT_TIMESTAMP)
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
    ('systemUsers', 'luongxuanhung', '{"username":"luongxuanhung","name":"Lương Xuân Hùng","role":"admin","systemRole":"admin","departmentRoleCode":"LEADERSHIP","fieldCodes":[],"active":true,"position":"Phó trưởng phòng","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'tranhoangphuong', '{"username":"tranhoangphuong","name":"Trần Hoàng Phương","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Khách DDT","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'nguyentuanthanh', '{"username":"nguyentuanthanh","name":"Nguyễn Tuấn Thành","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Khách DDT","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'vuthitham', '{"username":"vuthitham","name":"Vũ Thị Thắm","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Khách DDT","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'dangducbinh', '{"username":"dangducbinh","name":"Đặng Đức Bình","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Khách DDT","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'nguyenquocviet', '{"username":"nguyenquocviet","name":"Nguyễn Quốc Việt","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Khách DDT","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP),
    ('systemUsers', 'buithivananh', '{"username":"buithivananh","name":"Bùi Thị Vân Anh","role":"staff","systemRole":"staff","departmentRoleCode":"UNASSIGNED","fieldCodes":[],"active":true,"position":"Khách DDT","source":"PCN_INITIAL_IMPORT"}'::jsonb, CURRENT_TIMESTAMP)
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

-- A lot code is a business identifier, not just a UI label. Keep retries and
-- concurrent requests from creating two lots that differ only by casing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_sample_lots_lot_code_ci
ON app_documents (LOWER(data->>'lotCode'))
WHERE collection_name = 'pcnSampleLots' AND NULLIF(data->>'lotCode', '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_lab_requests_pyc_number_ci
ON app_documents (LOWER(data->>'pycNumber'))
WHERE collection_name = 'labRequests' AND NULLIF(data->>'pycNumber', '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcn_lab_requests_sample_route
ON app_documents ((data->>'sampleRouteId'))
WHERE collection_name = 'labRequests' AND NULLIF(data->>'sampleRouteId', '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcn_file_assets_source
ON file_assets (source_collection, source_document_id);
