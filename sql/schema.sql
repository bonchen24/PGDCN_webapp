-- Author: Gemini
-- OS support: Web/Node
-- Description: PostgreSQL schema definition for DDT Lab

CREATE TABLE IF NOT EXISTS system_config (
    id VARCHAR(50) PRIMARY KEY,
    auto_assign_testers BOOLEAN DEFAULT false,
    default_testers JSONB DEFAULT '[]'::jsonb,
    work_on_saturdays BOOLEAN DEFAULT true,
    work_on_sundays BOOLEAN DEFAULT false,
    deleted_customer_ids JSONB DEFAULT '[]'::jsonb,
    deleted_product_ids JSONB DEFAULT '[]'::jsonb,
    deleted_brand_ids JSONB DEFAULT '[]'::jsonb,
    deleted_tester_ids JSONB DEFAULT '[]'::jsonb,
    deleted_user_ids JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_users (
    id VARCHAR(100) PRIMARY KEY,
    uid VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    display_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES system_users(uid) ON DELETE CASCADE,
    gemini_api_key TEXT,
    custom_password TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(100),
    address TEXT,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    test_time_atd INT DEFAULT 0,
    test_time_emc INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS testers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    color_code VARCHAR(20) NOT NULL,
    role VARCHAR(50) DEFAULT 'TESTER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id VARCHAR(50) PRIMARY KEY,
    request_code VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    sample_status VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    address TEXT,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    tax_id VARCHAR(100),
    sender_unit VARCHAR(255),
    seal_stamp VARCHAR(255),
    sample_condition VARCHAR(100),
    post_test_handling VARCHAR(100),
    result_copy_count INT DEFAULT 1,
    priority VARCHAR(50) DEFAULT 'NORMAL',
    samples JSONB DEFAULT '[]'::jsonb,
    encode_number VARCHAR(100),
    atd_encode_number VARCHAR(100),
    emc_encode_number VARCHAR(100),
    note TEXT,
    received_date TIMESTAMP,
    test_date TIMESTAMP,
    deadline TIMESTAMP,
    tester_name VARCHAR(255),
    tester_note TEXT,
    emc_tester_name VARCHAR(255),
    emc_tester_note TEXT,
    chamber_id VARCHAR(50),
    emc_chamber_id VARCHAR(50),
    scheduled_date TIMESTAMP,
    end_date TIMESTAMP,
    emc_scheduled_date TIMESTAMP,
    emc_end_date TIMESTAMP,
    is_atd_completed BOOLEAN DEFAULT false,
    is_emc_completed BOOLEAN DEFAULT false,
    result JSONB,
    emc_result JSONB,
    history JSONB DEFAULT '[]'::jsonb,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handover_docs (
    id VARCHAR(50) PRIMARY KEY,
    doc_number VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    contact_person VARCHAR(255),
    sender_name VARCHAR(255),
    receiver_name VARCHAR(255),
    representative VARCHAR(255),
    transport_vehicle VARCHAR(255),
    handover_date TIMESTAMP,
    sample_list JSONB DEFAULT '[]'::jsonb,
    request_ids JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kqtn_records (
    id VARCHAR(50) PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    request_code VARCHAR(100) NOT NULL,
    report_no VARCHAR(100) NOT NULL,
    sample_code VARCHAR(100),
    seal_stamp VARCHAR(255),
    version VARCHAR(50) DEFAULT 'v1',
    sample_name VARCHAR(255),
    model VARCHAR(255),
    brand VARCHAR(255),
    sender_unit VARCHAR(255),
    standard_title TEXT,
    criteria_type VARCHAR(100),
    test_date VARCHAR(100),
    report_date VARCHAR(100),
    tester_name VARCHAR(255),
    nameplate_photos JSONB DEFAULT '[]'::jsonb,
    test_results_data JSONB,
    emc_data JSONB,
    day_cap_dien_data JSONB,
    version_history JSONB DEFAULT '[]'::jsonb,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS day_configs (
    id VARCHAR(50) PRIMARY KEY,
    date VARCHAR(20) NOT NULL,
    is_work_day BOOLEAN NOT NULL,
    note TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_documents (
    collection_name VARCHAR(100) NOT NULL,
    document_id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_name, document_id)
);

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

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_requests_code ON requests(request_code);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_kqtn_request ON kqtn_records(request_id);
CREATE INDEX IF NOT EXISTS idx_kqtn_report_no ON kqtn_records(report_no);
CREATE INDEX IF NOT EXISTS idx_app_documents_collection_updated ON app_documents(collection_name, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_documents_activity_created
ON app_documents ((data->>'createdAt') DESC, document_id DESC)
WHERE collection_name = 'activityLogs';

CREATE INDEX IF NOT EXISTS idx_file_assets_source
ON file_assets (source_collection, source_document_id);

-- --- End of schema.sql ---
