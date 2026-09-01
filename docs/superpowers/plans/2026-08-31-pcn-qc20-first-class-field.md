# PCN QC20 First-Class Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development before writing production code.

**Goal:** Bổ sung QC20 như một Lĩnh vực PCN vận hành được trong cùng card Đề nghị, pipeline, checklist, mã hóa lô mẫu, PYC, KQTN và phát hành với QC4/QC9.

**Architecture:** Dùng `PcnCertificationFieldCode` và catalog Lĩnh vực làm nguồn chuẩn. QC20 có metadata mặc định `QCVN 20:2019/BKHCN` và sửa đổi 1:2021, nhưng phạm vi sản phẩm/mã HS/chỉ tiêu là cấu hình cần Admin PCN xác nhận. Không tạo route, màn hình, collection hay luồng riêng cho QC20; filter, multi-field dossier và các vùng card hiện tại tự nhận diện mã mới.

**Tech Stack:** TypeScript, Next.js App Router, React, PostgreSQL/Supabase self-host trên Docker Desktop, SQL bootstrap idempotent, Node test runner/tsx.

**Spec:** `design.md` mục 0.1–0.5 là hợp đồng trước khi code; QC20 không được coi là sản phẩm điện của QC4/QC9, không có dữ liệu/hồ sơ nguồn thật trong fixture/runtime.

## Tasks

- [x] Add failing contract tests for QC20 field metadata, document requirements, template catalog and SQL seed.
- [x] Extend the active TypeScript field/catalog contracts and runtime helpers to accept QC20.
- [x] Add QC20 default field metadata, checklist/station mapping and safe template placeholders without claiming unverified official templates.
- [x] Add idempotent QC20 field/requirement rows to the PCN schema bootstrap.
- [x] Verify the dashboard/proposal field filters and multi-field dossier paths keep QC20 visible.
- [x] Run focused tests, build, lint and diff checks; record any stale legacy-test failures separately.
- [x] Keep the dossier checklist read-only and expose document-version upload in one dedicated document region.

## Guardrails

- Không đọc hoặc tham chiếu thư mục nghiên cứu khi app chạy.
- Không đưa QC20 vào danh sách khách hàng, role hệ thống hoặc route riêng.
- Không sửa luồng DDT và không khôi phục các màn hình lịch sử đã loại khỏi runtime PCN.
- Không ghi đè cấu hình QC4/QC9 hiện có khi bootstrap.
