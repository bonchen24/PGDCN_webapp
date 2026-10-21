# Handoff Report: R2.1 - Data Models, Schema, Lifecycle & Business Rules Review

## 1. Observation

1. **Về vị trí Type và Schema trong codebase**:
   - `design.md` dòng 1149 ghi: `"Toàn bộ Type định nghĩa hệ thống nằm ở file /types.ts."`
   - Thực tế kiểm tra:
     * `types.ts` (1756 dòng) chứa các Interface của PCN (`CertificationProposal`, `CertificationDossier`, `PcnSampleLot`, `PcnSampleItem`, `PcnSampleRoute`, `OutboundLabRequest`, `ReturnedTestResult`, `IssuancePackage`, `PcnWorkflowTemplate`...), User/Auth (`UserAccount`, `PcnUserAccount`), Notifications, Activity Log và DDT legacy types (`TestRequest`, `HandoverDoc`).
     * Không có `PgdInspectionRequest` trong `types.ts`.
     * Toàn bộ Data Models của Phân hệ PGD nằm tại `utils/pgdDomain.ts` (dòng 707-802: `PgdInspectionRequest`, dòng 897-911: `PgdInspectionAssignment`, dòng 915-941: `PgdFieldInspection`, dòng 945-972: `PgdSample`, dòng 1038-1057: `PgdLabRequest`, dòng 1067-1078: `PgdLabResult`, dòng 1103-1116: `PgdInspectionReport`, dòng 1118-1130: `PgdApprovalStep`, dòng 1142-1157: `PgdInspectionCertificate`), `utils/pgdDossier.ts` (dòng 83-112: `PgdDossierDocument`), và `utils/pgdArtifacts.ts` (dòng 37: `PgdSamplingLine`, dòng 47: `PgdInspectionPlan`, dòng 69: `PgdCaseEvent`, dòng 92: `PgdFieldActivityLog`, dòng 110: `PgdLabResultReview`, dòng 146: `PgdDossierIndex`).

2. **Về file Topology PCN**:
   - Dispatch yêu cầu kiểm tra `utils/pcnWorkflowTopology.ts`.
   - Lệnh tìm kiếm file xác nhận `utils/pcnWorkflowTopology.ts` không tồn tại.
   - Nghiệp vụ Topology lưu trình PCN thực tế nằm tại hai file: `utils/pcnWorkflowTemplate.ts` (quản trị template, node/transition definitions, điều kiện rẽ nhánh) và `utils/pcnWorkflowRuntime.ts` (tính toán trạng thái runtime DAG, join policy `ALL`/`ANY`/`QUORUM`, cơ chế cycle rework và trả lại).

3. **Về quy tắc nghiệp vụ QC4, QC9 vs QC20**:
   - `types.ts` dòng 222: `export const PCN_CERTIFICATION_FIELD_CODES = ['QC4', 'QC9'] as const;`.
   - `utils/pcnWorkflow.ts` dòng 10-23: `DEFAULT_PCN_CERTIFICATION_FIELDS` chỉ gồm `QC4` và `QC9`.
   - Không có `QC20` trong toàn bộ code PCN. `QC20` chỉ xuất hiện ở `utils/pgdDomain.ts` dòng 77-78 (`PGD_QC20_GROUP_CODE = 'QC20'`) làm mã nhóm cho thép không gỉ (profile `GĐ-THEP-KG`).

4. **Về mã hóa chứng từ**:
   - PCN Đề nghị (`utils/pcnIdentifier.ts` dòng 53): `formatPcnProposalCode(serial, date)` tạo `PCN-YYMMDD-TT` (serial 1..99).
   - PCN Lô mẫu (`utils/pcnIdentifier.ts` dòng 74): `formatPcnSampleLotCode(serial, date)` tạo `CN TTTT-YY` (serial 1..9999).
   - PGD PYC (`utils/pgdDomain.ts` dòng 222): `formatPgdRequestCode(serial, date)` tạo `PGD-YYMMDD-TT` (serial 1..99).

5. **Về Lifecycle và State Transitions**:
   - PCN Dossier: `types.ts` dòng 262-281 định nghĩa chính xác 19 trạng thái theo spec.
   - PGD Request: `utils/pgdDomain.ts` dòng 33-48 định nghĩa chính xác 15 trạng thái theo spec; dòng 1475-1520 (`PGD_TRANSITIONS` và `getPgdTransitionDenial`) thực thi chuyển trạng thái tuần tự và các điều kiện tiên quyết nghiêm ngặt.
   - PGD 5 trạm thao tác: `utils/pgdWorkflow.ts` dòng 33-69 định nghĩa `PGD_OPERATIONAL_STATIONS` (1. Tiếp nhận & năng lực, 2. Chuẩn bị & phân công, 3. Hiện trường & lấy mẫu, 4. PTN & xem xét kết quả, 5. Báo cáo, phê duyệt & trả kết quả).
   - PGD Phê duyệt hai cấp: `utils/pgdDomain.ts` dòng 1133-1136 (`PGD_APPROVAL_CHAIN`: sequence 1 `TECHNICAL_REVIEW` và sequence 2 `LEADERSHIP_APPROVAL`).

6. **Về kết quả kiểm thử tự động**:
   - Lệnh `npm test` thực thi 934 tests: **934 passed, 0 failed** (thời gian chạy 13.7s).

## 2. Logic Chain

1. **Từ Observation 1 và 2**: Mã nguồn thực tế đã được module hóa cao để phân tách ranh giới rõ ràng giữa hai phân hệ (PCN tập trung ở `types.ts` và `utils/pcn*`; PGD tập trung ở `utils/pgd*`). Việc `design.md` Mục 6 ghi "Toàn bộ Type nằm ở `/types.ts`" là mô tả trước khi phân hệ PGD được hoàn thiện mở rộng theo Mục 0A. Do đó, logic cho thấy mã nguồn không sai, mà Mục 6 của tài liệu `design.md` cần được cập nhật bổ sung để phản ánh đúng hiện trạng module hóa.
2. **Từ Observation 3**: Ranh giới nghiệp vụ giữa PCN và PGD được thực thi tuyệt đối: `QC4`/`QC9` chỉ thuộc PCN; `QC20` chỉ thuộc PGD (thép không gỉ). Các bài test tự động (`test/pcn-qc20-field.test.ts`, `test/pcn-qc20-governance.test.ts`) khẳng định không có sự lẫn lộn dữ liệu giữa hai miền.
3. **Từ Observation 4**: Định dạng mã định danh giữa PCN và PGD hoàn toàn tách biệt, đúng quy cách theo ngày/năm và có cơ chế transaction sequence ở server chống trùng lặp.
4. **Từ Observation 5**: Vòng đời trạng thái của cả PCN và PGD đều khớp 100% với đặc tả, có state machine và cổng điều kiện (stage gate) ngăn chặn thao tác vượt bước hoặc bỏ sót tài liệu.
5. **Từ Observation 6**: Toàn bộ 934 bài kiểm thử của dự án đều vượt qua, chứng minh độ tin cậy và tính ổn định cao của tầng dữ liệu và logic nghiệp vụ.

## 3. Caveats

- **Phạm vi khảo sát**: Tập trung hoàn toàn vào Data Models, Schema, Lifecycle & Business Rules (Mục 0, 0A, 6 của `design.md`). Không đi sâu vào chi tiết CSS tokens, giao diện thẻ Card (phạm vi của R1) hoặc chi tiết route server / middleware xác thực phiên (phạm vi của R2.2).
- **Mã nguồn không bị sửa**: Tuân thủ tuyệt đối quy định read-only của Explorer, không có bất kỳ dòng mã nguồn nào bị thay đổi trong quá trình rà soát.

## 4. Conclusion

- **Đánh giá chung**: Hệ thống PGDCN Web App tuân thủ xuất sắc các quy chuẩn nghiệp vụ, mô hình dữ liệu và quy trình chuyển đổi trạng thái của cả hai phân hệ PCN và PGD theo đặc tả chuẩn `design.md`.
- **Sai lệch chính**: Là sai lệch tài liệu (Documentation Drift trong Mục 6 `design.md`), không phải lỗi mã nguồn.
- **Hành động đề xuất cho Orchestrator**:
  1. Cập nhật Mục 6 `design.md`: Ghi rõ cấu trúc phân bổ type (`/types.ts` cho PCN & Shared; `utils/pgd*.ts` cho PGD).
  2. Bổ sung danh mục các Interface PCN Workflow Topology vào Mục 6.
  3. Bổ sung tiểu mục 6.2 liệt kê đầy đủ 14 Interface cốt lõi của PGD vào Mục 6.
  4. Đánh dấu mục chuyển đổi ITDC → ITD là [Legacy Reference].
  5. Xem chi tiết tại: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_data_lifecycle\report_data_lifecycle.md`.

## 5. Verification Method

- **Chạy lại toàn bộ bộ kiểm thử tự động của dự án**:
  ```bash
  npm test
  ```
  *Kỳ vọng*: 934 tests passed, 0 failed.
- **Kiểm tra độc lập các file mã nguồn liên quan**:
  * PCN Data Models: `types.ts` (dòng 218-577, 928-1235)
  * PCN Workflow Topology: `utils/pcnWorkflowTemplate.ts` và `utils/pcnWorkflowRuntime.ts`
  * PCN Code Policy & Identifiers: `utils/pcnCodePolicy.ts` và `utils/pcnIdentifier.ts`
  * PGD Data Models & State Machine: `utils/pgdDomain.ts` (dòng 33-48, 234-448, 707-1157, 1475-1520)
  * PGD Dossier Checklist & Samples: `utils/pgdDossier.ts`
  * PGD Operational Stations: `utils/pgdWorkflow.ts` (dòng 33-69)
  * PGD Supplementary Entities: `utils/pgdArtifacts.ts`
  * Kiểm tra cách ly QC20: `test/pcn-qc20-field.test.ts` và `test/pcn-qc20-governance.test.ts`.
