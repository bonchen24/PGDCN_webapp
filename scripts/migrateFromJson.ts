import { pool, initDbSchema } from '../utils/db.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function runMigration() {
  console.log('--- BẮT ĐẦU RESTORE TỪ JSON BACKUP SANG POSTGRESQL ---');
  
  await initDbSchema();
  const pgClient = await pool.connect();

  try {
    const filePath = path.join(process.cwd(), 'tvci_backup_2026-08-17_1.json');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy file: ${filePath}`);
    }

    const dataRaw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(dataRaw);

    const { requests, handoverDocs, kqtnRecords, customers, products, brands, dayConfigs, systemUsers, settings } = data;
    console.log(`Đã đọc được: ${requests?.length || 0} yêu cầu, ${customers?.length || 0} khách hàng, ${systemUsers?.length || 0} users...`);

    const queries = [
      'customers', 'products', 'brands', 'requests', 'handover_docs', 'system_config', 'kqtn_records'
    ].map(t => `ALTER TABLE ${t} ALTER COLUMN id TYPE TEXT;`);
    
    for (const q of queries) await pgClient.query(q);

    // requests
    const requestCols = ['request_code', 'status', 'sample_status', 'customer_name', 'contact_person', 'phone', 'tax_id', 'sender_unit', 'seal_stamp', 'sample_condition', 'post_test_handling', 'priority', 'encode_number', 'atd_encode_number', 'emc_encode_number', 'tester_name', 'emc_tester_name', 'chamber_id', 'emc_chamber_id', 'created_by'];
    for (const c of requestCols) await pgClient.query(`ALTER TABLE requests ALTER COLUMN ${c} TYPE TEXT;`);

    // handover_docs
    await pgClient.query(`ALTER TABLE handover_docs ALTER COLUMN doc_number TYPE TEXT;`);

    // kqtn_records
    const kqtnCols = ['request_code', 'report_no', 'sample_code', 'seal_stamp', 'version', 'sample_name', 'model', 'brand', 'sender_unit', 'criteria_type', 'test_date', 'report_date', 'tester_name', 'created_by'];
    for (const c of kqtnCols) await pgClient.query(`ALTER TABLE kqtn_records ALTER COLUMN ${c} TYPE TEXT;`);

    // 1. Migrate Customers
    console.log('Đang restore Customers...');
    if (customers && customers.length > 0) {
      for (const c of customers) {
        const id = c.customerCode || c.name;
        if (!id) continue;
        await pgClient.query(`
          INSERT INTO customers (id, name, tax_id, address, contact_person, phone)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET 
            name=EXCLUDED.name, tax_id=EXCLUDED.tax_id, address=EXCLUDED.address, 
            contact_person=EXCLUDED.contact_person, phone=EXCLUDED.phone
        `, [id, c.name, c.taxId, c.address, c.contactPerson, c.phone]);
      }
    }

    // 2. Migrate Products
    console.log('Đang restore Products...');
    if (products && products.length > 0) {
      for (const p of products) {
        const name = p.name;
        if (!name) continue;
        await pgClient.query(`
          INSERT INTO products (id, name, test_time_atd, test_time_emc)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET 
            test_time_atd=EXCLUDED.test_time_atd, test_time_emc=EXCLUDED.test_time_emc
        `, [name, name, Number(p.testTimeATD) || 0, Number(p.testTimeEMC) || 0]);
      }
    }

    // 3. Migrate Brands
    console.log('Đang restore Brands...');
    if (brands && brands.length > 0) {
      for (const b of brands) {
        const name = typeof b === 'string' ? b : b.name;
        if (!name) continue;
        await pgClient.query(`
          INSERT INTO brands (id, name)
          VALUES ($1, $2)
          ON CONFLICT (id) DO NOTHING
        `, [name, name]);
      }
    }

    // 4. Migrate System Users
    console.log('Đang restore System Users...');
    if (systemUsers && systemUsers.length > 0) {
      for (const u of systemUsers) {
        const id = u.id || u.uid || u["Tên đăng nhập"] || u.username || u.email;
        if (!id) continue;
        const username = u.username || u["Tên đăng nhập"] || id;
        const name = u.name || u["Họ và Tên"] || u.displayName || username;
        const role = u.role || u["Loại tài khoản"] || 'viewer';
        await pgClient.query(`
          INSERT INTO system_users (id, uid, email, role, display_name, is_active)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            uid=EXCLUDED.uid, email=EXCLUDED.email, role=EXCLUDED.role, display_name=EXCLUDED.display_name
        `, [id, username, u.email || username, role, name, true]);
      }
    }

    // 5. Migrate Requests
    console.log('Đang restore Requests...');
    if (requests && requests.length > 0) {
      for (const r of requests) {
        if (!r.id) continue;
        await pgClient.query(`
          INSERT INTO requests (
            id, request_code, status, sample_status, customer_name, address, contact_person, phone, tax_id, sender_unit,
            seal_stamp, sample_condition, post_test_handling, result_copy_count, priority, samples, encode_number, 
            atd_encode_number, emc_encode_number, note, received_date, test_date, deadline, tester_name, tester_note, 
            emc_tester_name, emc_tester_note, chamber_id, emc_chamber_id, scheduled_date, end_date, emc_scheduled_date, 
            emc_end_date, is_atd_completed, is_emc_completed, result, emc_result, history, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41
          ) ON CONFLICT (id) DO UPDATE SET
            request_code=EXCLUDED.request_code, status=EXCLUDED.status, sample_status=EXCLUDED.sample_status, 
            customer_name=EXCLUDED.customer_name, samples=EXCLUDED.samples, scheduled_date=EXCLUDED.scheduled_date,
            tester_name=EXCLUDED.tester_name, result=EXCLUDED.result, note=EXCLUDED.note, updated_at=EXCLUDED.updated_at
        `, [
          r.id, r.requestCode, r.status, r.sampleStatus, r.customerName, r.address, r.contactPerson, r.phone, r.taxId, r.senderUnit,
          r.sealStamp, r.sampleCondition, r.postTestHandling, r.resultCopyCount, r.priority, JSON.stringify(r.samples), r.encodeNumber,
          r.atdEncodeNumber, r.emcEncodeNumber, r.note, r.receivedDate ? new Date(r.receivedDate) : null, r.testDate ? new Date(r.testDate) : null, 
          r.deadline ? new Date(r.deadline) : null, r.testerName, r.testerNote, r.emcTesterName, r.emcTesterNote, r.chamberId, r.emcChamberId, 
          r.scheduledDate ? new Date(r.scheduledDate) : null, r.endDate ? new Date(r.endDate) : null, r.emcScheduledDate ? new Date(r.emcScheduledDate) : null, 
          r.emcEndDate ? new Date(r.emcEndDate) : null, r.isAtdCompleted, r.isEmcCompleted, r.result ? JSON.stringify(r.result) : null, 
          r.emcResult ? JSON.stringify(r.emcResult) : null, JSON.stringify(r.history || []), r.createdBy, r.createdAt ? new Date(r.createdAt) : new Date(), 
          r.updatedAt ? new Date(r.updatedAt) : new Date()
        ]);
      }
    }

    // 6. Migrate Handover Docs
    console.log('Đang restore Handover Docs...');
    if (handoverDocs && handoverDocs.length > 0) {
      for (const h of handoverDocs) {
        if (!h.id) continue;
        await pgClient.query(`
          INSERT INTO handover_docs (
            id, doc_number, type, customer_name, contact_person, sender_name, receiver_name, 
            representative, transport_vehicle, handover_date, sample_list, request_ids, notes, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            doc_number=EXCLUDED.doc_number, customer_name=EXCLUDED.customer_name, sample_list=EXCLUDED.sample_list, updated_at=EXCLUDED.updated_at
        `, [
          h.id, h.docNumber, h.type, h.customerName, h.contactPerson, h.senderName, h.receiverName,
          h.representative, h.transportVehicle, h.handoverDate ? new Date(h.handoverDate) : null, JSON.stringify(h.sampleList),
          JSON.stringify(h.requestIds), h.notes, h.createdBy, h.createdAt ? new Date(h.createdAt) : new Date(), 
          h.updatedAt ? new Date(h.updatedAt) : new Date()
        ]);
      }
    }

    // 7. Migrate KQTN Records
    console.log('Đang restore KQTN Records...');
    if (kqtnRecords && kqtnRecords.length > 0) {
      for (const k of kqtnRecords) {
        if (!k.id) continue;
        await pgClient.query(`
          INSERT INTO kqtn_records (
            id, request_id, request_code, report_no, sample_code, seal_stamp, version, sample_name, model, brand, sender_unit,
            standard_title, criteria_type, test_date, report_date, tester_name, nameplate_photos, test_results_data, 
            emc_data, day_cap_dien_data, version_history, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          ON CONFLICT (id) DO UPDATE SET
            test_results_data=EXCLUDED.test_results_data, updated_at=EXCLUDED.updated_at
        `, [
          k.id, k.requestId || k.request_id || k.id, k.requestCode || k.request_code || k.reportNo || k.id, k.reportNo || k.report_no || k.id, k.sampleCode, k.sealStamp, k.version, k.sampleName,
          k.model, k.brand, k.senderUnit, k.standardTitle, k.criteriaType, k.testDate, k.reportDate,
          k.testerName, JSON.stringify(k.nameplatePhotos || []), k.testResultsData ? JSON.stringify(k.testResultsData) : null,
          k.emcData ? JSON.stringify(k.emcData) : null, k.dayCapDienData ? JSON.stringify(k.dayCapDienData) : null,
          JSON.stringify(k.versionHistory || []), k.createdBy, k.createdAt ? new Date(k.createdAt) : new Date(),
          k.updatedAt ? new Date(k.updatedAt) : new Date()
        ]);
      }
    }

    console.log('--- HOÀN THÀNH RESTORE TỪ JSON THÀNH CÔNG ---');
  } catch (error) {
    console.error('Lỗi khi restore:', error);
  } finally {
    pgClient.release();
    process.exit(0);
  }
}

runMigration();
