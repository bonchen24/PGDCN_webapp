# Audit vận hành end-to-end PGDCN

- **Ngày audit:** 2026-10-22
- **Baseline:** nhánh master, HEAD 90f98c9.
- **Loại audit:** rà soát tĩnh mã nguồn, tài liệu, test, dependency và worktree; không kiểm tra trên dữ liệu vận hành.
- **Phạm vi:** PCN và PGD, từ tiếp nhận đến hoàn tất; khách hàng; phân công; mẫu/PYC/KQTN; tài liệu DOCX/PDF; xem xét/phê duyệt/phát hành; RBAC; AI; dashboard; UX desktop/mobile; rủi ro vận hành.
- **Tài liệu thiết kế:** design.md là SSOT hiện hành. Audit không sửa tài liệu đó. Không có thư mục docs/decisions tại baseline.

## Tóm tắt điều hành

Ứng dụng đang chạy bằng Next.js App Router. Có nhiều nền tảng nghiệp vụ đã được kiểm tra bằng code và test: tiếp nhận PCN trong transaction, snapshot workflow PCN, tác vụ có kiểm tra cycle/owner, cổng bằng chứng PGD và boundary phát hành PCN. Các kết quả này chứng minh một số hợp đồng ở mức mã nguồn/test, không chứng minh môi trường production hay toàn bộ luồng người dùng đã vận hành đúng.

Rủi ro ưu tiên cao nhất nằm ở các ranh giới API. Các route generic /api/db dùng session hợp lệ nhưng không gọi policy collection/scope/viewer; một số route Gemini, extract-radimation và KQTN PDF cũng không có guard nhất quán. Đây là phát hiện tĩnh có thể xác định từ handler; chưa có thử nghiệm request với database thật. Một số route liên quan KQTN có thể là legacy, nên tác động dữ liệu phụ thuộc việc còn record/asset legacy được phục vụ hay không.

PGD có API quản trị workflow template và tải template vào bootstrap/store, nhưng runtime transition dùng các operational station/gate cố định. Chưa tìm thấy nơi request PGD pin template revision/snapshot hoặc runtime đọc topology từ template. Điều này chưa khớp hợp đồng snapshot trong design.md. PCN dashboard đã có “Việc của tôi” và Next Action; giao diện mobile/visual hiện hành chưa được xác minh. Các QA worktree UX chưa tích hợp và một gate branch ghi NOT READY.

Không có P0 nào được chứng minh. Các hạng mục P1 cần xử lý trước là ranh giới generic DB, route không xác thực có thể tiếp cận qua Next, và phân loại/giảm rủi ro dependency parser. Đề xuất triển khai theo thứ tự: đóng access boundary → xử lý parser/dependency và route legacy → xác nhận runtime workflow PGD → xác nhận vòng đời mẫu/KQTN → hoàn thiện tài liệu/AI → UX work-first và kiểm thử trực quan.

## Phạm vi, cách làm và mức độ bằng chứng

Đã đối chiếu design.md: profile/boundary và customer scope (khoảng dòng 49–60); PCN workflow snapshot (84–104); PGD work rail/lifecycle (123–133); workflow template và sample flow (489–526); RBAC, storage, API và audit (1167–1268); work-first/progressive disclosure/evidence-first (1367–1376 và 1658–1721).

Đã rà route App Router, helper auth/RBAC, lưu trữ, workflow và component được nêu trong bảng; đọc test phù hợp; kiểm tra HEAD, git status và tất cả worktree mà git liệt kê; chạy lint, test, build, audit dependency. Không đọc secrets, backup, nội dung .temp, ảnh QA, file khách hàng hay object Storage.

Trạng thái trong bảng:

- **Đạt:** implementation/test đã trực tiếp chứng minh phần yêu cầu được nêu; không đồng nghĩa đã kiểm chứng production.
- **Đạt một phần:** đã có code/test nhưng còn thiếu hợp đồng, tích hợp hoặc kiểm chứng end-to-end.
- **Chưa đạt:** có bằng chứng code cho thấy hành vi hiện tại không thỏa yêu cầu đã ghi trong design.md hoặc boundary an toàn.
- **Chưa kiểm chứng:** chưa đủ bằng chứng để kết luận; không suy diễn thành đạt hay lỗi.

“Static” nghĩa là đọc handler/config/test; “test” nghĩa là test chạy thành công; “runtime” nghĩa là request trên môi trường có dữ liệu thật. Audit này không chạy kiểm thử runtime với dữ liệu thật.

Mức độ: **P0** là sự cố nghiêm trọng đang gây mất dữ liệu/chiếm quyền với phạm vi rộng; **P1** là ranh giới bảo vệ hoặc dữ liệu cần xử lý trước rollout mở rộng; **P2** là thiếu hụt workflow/UX/kiểm soát cần xử lý theo thứ tự; **P3** là cải tiến hoặc năng lực chưa có bằng chứng cần lên kế hoạch. Mức độ thể hiện ưu tiên, không phải kết luận khai thác đã tái hiện.

## Kiến trúc as-is

- **Entrypoint:** package.json dùng next build và scripts/run-next-start.cjs; Next build tạo route manifest cho app/api/**. server.legacy.ts là legacy, không phải entrypoint Next đang chạy. README.md khoảng dòng 87 mô tả test:all cho tiện ích legacy.
- **PCN:** các route hoạt động nằm dưới /api/pcn; UI/store riêng. app/api/pcn/intake tạo hồ sơ qua transaction và snapshot workflow template. lib/server/workflow-tasks giữ lock/owner/cycle gate. Issuance có route riêng cho approval, issue, deliver, archive.
- **PGD:** route nghiệp vụ nằm dưới /api/pgd, dữ liệu có boundary PGD riêng và guard trong lib/server/pgd.ts. Request, mẫu, PTN, kết quả, tài liệu và các event là các collection/domain PGD; request không nên ghi qua generic /api/db theo design.md.
- **Persistence:** route generic và domain routes lưu document trong PostgreSQL app_documents; file đi qua private Storage cùng metadata/provenance. Đây không phải bằng chứng cho dữ liệu production.
- **Quyền:** có các helper policy trong utils/pcnRbac.ts và PGD guard riêng, nhưng guard tồn tại trong thư viện không có nghĩa mọi route đều gọi guard đó. Không tìm thấy middleware/proxy toàn cục bảo vệ mọi route.
- **DDT legacy:** design.md coi DDT là legacy reference. Tuy nhiên Next build vẫn expose một số route tên cũ, như /api/kqtn/[recordId]/pdf và /api/extract-radimation; cần quyết định profile gating và xác minh có dữ liệu legacy cần phục vụ.
- **AI/tài liệu:** có route AI chuyên biệt cho PCN/PGD và các route Gemini tổng quát. DOCX/PDF được sinh qua các API riêng; phần kiểm tra này xác nhận tồn tại code/test, không xác minh độ giống mẫu nghiệp vụ thật.

## Ma trận truy xuất yêu cầu

| Yêu cầu | Route/component/data | Test hoặc bằng chứng | Trạng thái |
|---|---|---|---|
| PCN tiếp nhận và tạo hồ sơ | app/api/pcn/intake/route.ts:65–70, 154–191; CertificationProposal/CertificationDossier; snapshot workflow | test/pcn-intake-contract.test.ts; test/pcn-intake-validation.test.ts | **Đạt một phần** — transaction/snapshot có test; chưa chạy luồng UI/API trên môi trường tích hợp |
| PCN phân công và xử lý tác vụ | lib/server/workflow-tasks.ts:43–76; /api/pcn/dossiers/[dossierId]/workflow-tasks/** | test/pcn-workflow-required-server-gate.test.ts; test/pcn-workflow-runtime.test.ts | **Đạt một phần** — gate/owner/cycle được unit test; chưa kiểm chứng thao tác của từng vai trò trên runtime |
| PGD tiếp nhận, phân công, chuyển trạng thái | /api/pgd/requests, /assignments, /requests/[requestId]/transition; app_documents; lib/server/pgd.ts | test/pgd-intake-sample-boundary.test.ts; test/pgd-workflow.test.ts; route dùng transaction và FOR UPDATE | **Đạt một phần** — boundary/gate có bằng chứng; template admin chưa được chứng minh là runtime snapshot |
| PGD workflow template được pin cho từng hồ sơ | /api/pgd/workflow-templates/**; bootstrap/store; PgdInspectionRequest | test/pgd-workflow-template-api-contract.test.ts kiểm tra CRUD/bootstrap; request/transition dùng utils/pgdWorkflow.ts và station gate cố định | **Chưa đạt** theo hợp đồng snapshot trong design.md — chưa tìm thấy pin revision/topology vào request |
| Khách hàng dùng chung và snapshot theo hồ sơ | /api/pcn/customers/**; intake PCN/PGD | test/pcn-customer-boundary.test.ts; test/pcn-customer-reconciliation-ui.test.ts; design.md 0A | **Đạt một phần** — API/mutation được test; chưa kiểm chứng dữ liệu thực và quy tắc đồng bộ hồ sơ hiện hữu |
| Mẫu, PYC, tuyến PTN và nhận KQTN | PCN /api/pcn/sample-request-bundles/**, /lab-requests/**, /results; PGD /samples, /lab-requests, /lab-results; ReturnedTestResult/PgdSample/PgdLabResult | test/pcn-pgd-sample-ledger-ui.test.ts; test/pcn-pgd-dossier-samples.test.ts; test/pgd-intake-sample-boundary.test.ts | **Đạt một phần** — entity và boundary có test; chưa kiểm chứng đối soát với hệ thống PTN bên ngoài/retry qua mạng |
| Xét duyệt, ký, phát hành, giao và lưu trữ PCN | /api/pcn/issuance/**; IssuancePackage | test/pcn-approval-issuance.test.ts; test/pcn-issuance-boundary.test.ts | **Đạt một phần** — cổng nghiệp vụ có test; chưa chạy end-to-end với người ký/storage triển khai |
| DOCX/PDF và phiên bản tài liệu | /api/pcn/documents/generate; /api/pgd/documents/generate; document templates; private file assets | test/pcn-document-generation.test.ts; test/pgd-document-api-contract.test.ts; test/pgd-document-generation.test.ts | **Đạt một phần** — tạo file/context có test; chưa đối chiếu đầu ra với toàn bộ mẫu chính thức hoặc font trên máy người dùng |
| RBAC, scope và viewer | lib/server/auth.ts:175–194; utils/pcnRbac.ts:75–83, 110–123, 182–210; lib/server/pgd.ts | test/pcn-rbac-boundary.test.ts kiểm tra server.legacy.ts; generic Next DB handlers chỉ gọi getSessionUser | **Chưa đạt** ở generic /api/db boundary; các route domain cần rà từng action |
| Riêng tư file và upload | /api/pcn/files:15–65; /api/pcn/files/[assetId]:13–55; /api/extract-radimation:296–305 | test/pcn-file-boundary.test.ts và pcn-file-download-auth.test.ts chủ yếu kiểm tra legacy boundary; build manifest xác nhận route Next | **Đạt một phần** — PCN private storage/provenance có cấu trúc; route scope và giới hạn buffer chưa được chứng minh đầy đủ |
| AI đọc hồ sơ, tư vấn và trích xuất | /api/pgd/assistant/review; /api/pcn/assistant; /api/pgdcn/drafting-ai; /api/gemini/** | test/gemini-log-redaction.test.ts và test PCN/PGD assistant tương ứng; generic Gemini routes thiếu guard nhất quán | **Đạt một phần** — AI chuyên biệt có hướng read-only; quyền generic routes, provider data policy và chất lượng nội dung chưa đủ bằng chứng |
| Dashboard, Next Action và trạng thái | components/PgdcnDashboardView.tsx; PcnWorkQueueView; PGD/PCN stores | test/pgdcn-dashboard.test.ts; test/pgdcn-intelligent-dashboard-ui.test.ts; test/pcn-work-queue.test.ts | **Đạt một phần** — projection và cue công việc có test; chưa đánh giá trực quan, dữ liệu thật và độ ưu tiên theo vai trò |
| Desktop/mobile 320–430px, accessibility | PgdcnDashboardView, PcnDossierNodeWorkPanel, PgdDossierStepWorkPanel | test responsive/static; các QA worktree branch không nằm ở HEAD master | **Chưa kiểm chứng** ở root trên trình duyệt thật |
| Hiệu năng, vận hành và triển khai | Next build và scripts hiện có; không có tải hoặc production run trong audit | lint/build pass; không chạy load test/deploy | **Chưa kiểm chứng** |

## Danh mục phát hiện P0–P3

Không có P0 đã chứng minh. Mức P1 là ưu tiên giảm rủi ro trước khi mở rộng truy cập; các phát hiện dưới đây là code-level, trừ khi ghi rõ kiểm thử.

| ID | Mức | Tác động và bằng chứng | Đường dẫn | Hướng xử lý | Nghiệm thu và phụ thuộc |
|---|---|---|---|---|---|
| A-01 | **P1** | Các route generic DB dựa trên session hợp lệ nhưng không gọi collection policy, scope PCN hoặc viewer guard. Collection allowlist chứa dữ liệu hệ thống và nghiệp vụ; khả năng đọc/ghi trái vai trò là hệ quả trực tiếp của handler, chưa thử trên DB thật. | app/api/db/[collection]/route.ts:25–40; app/api/db/[collection]/[id]/route.ts:26–62; app/api/db/[collection]/batch/route.ts:24–44; app/api/db/[collection]/delete-batch/route.ts:21–42; lib/server/collections.ts:5–37 | Áp policy theo operation + collection + domain/scope ở server; tách system/admin, audit append-only và dữ liệu nghiệp vụ. Lập danh sách client caller trước khi thu hẹp API. | Test mỗi collection/action với anonymous, viewer, PCN-only, PGD-only, manager/admin; kiểm tra đọc chéo domain, batch/delete, audit append-only. Phụ thuộc: ma trận role hiện hành và client migration inventory. |
| A-02 | **P1** | Endpoint extract-radimation nhận multipart và buffer toàn bộ file trước khi đưa cho AdmZip; handler không có guard session/profile hay giới hạn size/expanded bytes tại vị trí này. Có nguy cơ chiếm CPU/RAM qua request từ mạng nếu endpoint được expose theo deployment. Chưa chạy payload DoS. | app/api/extract-radimation/route.ts:296–305; package.json adm-zip | Thêm profile/auth boundary, giới hạn request trước parse, số entry và tổng uncompressed bytes; xem xét bản vá/alternative parser. | Test unauthenticated/profile, file vượt byte cap, ZIP khai báo size bất thường, nhiều entry; xác nhận handler dừng trước khi cấp phát lớn. Phụ thuộc: reverse proxy/body limit và worktree bản vá 71f1c81. |
| A-03 | **P1** | Các route Gemini tổng quát đã build trong Next không có session/scope guard tại một số handler. Điều này mở đường gọi dịch vụ AI/tiêu tốn quota và gửi prompt do caller kiểm soát; chưa chứng minh có thể đọc hồ sơ server-side từ endpoint đó. | app/api/gemini/chat/route.ts:12; app/api/gemini/generate/route.ts:23; app/api/gemini/extract-requests/route.ts:24; app/api/gemini/extract-results/route.ts:22; app/api/gemini/extract-kqtn-metadata/route.ts:22; app/api/gemini/extract-kqtn-bulk-structure/route.ts:32 | Đưa route vào profile/feature allowlist, yêu cầu scope và giới hạn payload/quota; chỉ chấp nhận context do server resolve nếu truy cập dữ liệu hồ sơ. | Test anonymous, scope sai, payload/quota và kiểm tra không gọi provider khi bị từ chối. Phụ thuộc: quyết định route nào còn phục vụ DDT legacy. |
| A-04 | **P1** | Route KQTN PDF có POST upload không thấy session check; GET chỉ kiểm tra KQTN session ở nhánh query download khi KQTN chưa được xác nhận thanh toán; DELETE không lấy request/auth. Đây là endpoint legacy có thể phục vụ dữ liệu nhạy cảm; tác động thực tế phụ thuộc record/asset còn tồn tại. | app/api/kqtn/[recordId]/pdf/route.ts:20–41, 125–177, 179–223 | Nếu ngoài active profile thì trả 404; nếu còn cần thì bắt buộc auth/role/domain check cho mọi method và giới hạn upload. | Test từng method, unpaid/paid, missing session, wrong profile, record khác scope; kiểm tra storage pointer và cleanup. Phụ thuộc: chủ sở hữu nghiệp vụ của dữ liệu KQTN legacy. |
| A-05 | **P1** | npm audit --omit=dev báo 2 critical, 10 high, 5 moderate. Một số parser nằm trên đường đọc dữ liệu: AdmZip ở extract-radimation và package routes; xlsx ở lib/server/pgd-assistant.ts:382; image-size trong generate-docx/extract-radimation. Một finding proxy-addr thuộc legacy chain; reachability của từng advisory khác nhau. | package.json/package-lock.json; app/api/extract-radimation/route.ts; lib/server/pgd-assistant.ts:382; app/api/generate-docx/route.ts | Phân loại dependency theo runtime/path và advisory precondition; ưu tiên cập nhật Next/parser có bản vá, thay/ghim xlsx nếu npm không có bản vá; không dùng npm audit fix --force nếu chưa đánh giá breaking changes. | Lưu SBOM/audit mới, kiểm tra route sử dụng package sau nâng cấp, test parser với dữ liệu giả lập. Phụ thuộc: worktree 71f1c81 và tương thích Next. |
| A-06 | **P2** | Collection workflow templates PGD được quản trị, bootstrap và giữ trong store; runtime transition dùng gate/station trong utils/pgdWorkflow.ts. Chưa thấy request pin template revision/snapshot; test xác minh API template không chứng minh runtime sử dụng template. | app/api/pgd/workflow-templates/**; app/api/pgd/bootstrap/route.ts:55, 111; components/PgdcnAppShell.tsx:367; app/api/pgd/requests/[requestId]/transition/route.ts:59; utils/pgdWorkflow.ts:183; test/pgd-workflow-template-api-contract.test.ts; test/pgd-workflow.test.ts | Quyết định template PGD là runtime contract hay chỉ admin catalog. Nếu là runtime, pin revision khi tạo request và dùng snapshot ở gate; nếu không, thu hẹp UI/nhãn để tránh hứa cấu hình không tác động. | Test template mới tác động hồ sơ mới, không đổi hồ sơ đang chạy, gate server từ snapshot. Phụ thuộc: nghiệp vụ PGD và cách migrate hồ sơ hiện có. |
| A-07 | **P2** | PCN upload gọi req.formData() rồi file.arrayBuffer() trước khi chuyển Buffer. Cấu hình giới hạn Storage không tự chứng minh giới hạn buffer ở bước parse request. | app/api/pcn/files/route.ts:15–65; lib/server/storage.ts | Áp giới hạn tổng request và file trước khi đọc bytes ở ingress; xác định rõ giới hạn loại file, nội dung và tổng số file; giữ provenance/checksum/compensation. | Test file quá cỡ bị từ chối trước Buffer/Storage write; test lỗi DB không để object mồ côi. Phụ thuộc: Next/runtime và reverse proxy support. |
| A-08 | **P2** | Summary hoạt động cần xác thực vì handler hiện không có guard nhìn thấy ở đầu GET; dữ liệu trả về có thể tiết lộ actor/project metrics. Chưa gửi request runtime. | app/api/activity-logs/summary/route.ts:22–91 | Áp shared audit boundary theo design.md và giới hạn projection theo scope; không trả nguồn dữ liệu miền khác. | Test anonymous, user không scope, PCN-only/PGD-only và aggregate đúng quyền. |
| A-09 | **P2** | Có dashboard work-first và static responsive tests, nhưng chưa có bằng chứng visual/browser QA của HEAD master ở 320–430px. QA ở worktree riêng, chưa tích hợp; gate của compact-worktable branch ghi NOT READY do thiếu D3 PCN panel. Đây là thiếu kiểm chứng ở baseline, không phải lỗi đã tái hiện trên master. | components/PgdcnDashboardView.tsx:153; test/pgdcn-dashboard.test.ts; .worktrees/pgdcn-compact-worktable-20261021/docs/ux/2026-10-21-compact-worktable-final-gate.md | Chọn một nhánh UX làm baseline, hợp nhất sau review; chạy visual QA trên build hiện hành bằng synthetic data và chặn API production. | Kiểm tra 320/375/390/430px, overflow, keyboard/touch/focus, current action, table density. Phụ thuộc: chọn branch/commit và hoàn tất panel D3. |
| A-10 | **P3** | Không có load test, production trace, retry/alert review hoặc deployment exercise trong phạm vi an toàn của audit. | README.md; scripts/run-next-start.cjs; route handlers | Lên kế hoạch kiểm tra read-only/perf trên staging và observability trước khi rollout. | Baseline latency/error/DB pool, upload limits, provider quota, backup/restore dry-run. Phụ thuộc: môi trường staging và người phụ trách vận hành. |

### Dependency và advisory notes

Kết quả hiện tại là npm audit trên lockfile, không phải khẳng định tất cả package đều reachable từ request của người dùng:

- **adm-zip <= 0.6.0:** advisory về cấp phát/giải nén không kiểm soát và lỗi async decompression; route upload Radimation là đường dùng file đầu vào. [GHSA-7q85-xj36-vmfc](https://github.com/advisories/GHSA-7q85-xj36-vmfc), [GHSA-8238-w5pm-2374](https://github.com/advisories/GHSA-8238-w5pm-2374).
- **xlsx 0.18.5:** prototype pollution/ReDoS; dùng trong PGD assistant để đọc spreadsheet. Audit npm báo không có fix npm tại lần chạy này. [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).
- **image-size 2.0.2:** advisories DoS cho một số format; package được dùng ở các luồng image/docx. Chỉ áp dụng với input format tương ứng. [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
- **Next 16.3.7:** npm audit báo high; một số advisory phụ thuộc việc bật use cache/Draft Mode, SSG/ISR hoặc Image Optimization. Cần kiểm feature trước khi khẳng định exploitability. [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7), [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676).
- **xmldom** và **@xmldom/xmldom** là hai package khác nhau; audit ghi nhận finding critical/high trong dependency tree DOCX. Đánh giá transitive path và khả năng vá riêng. [GHSA-h6q6-9hqw-rwfv](https://github.com/advisories/GHSA-h6q6-9hqw-rwfv).
- **proxy-addr** được audit đánh critical trong dependency tree legacy. App chạy Next start theo package scripts; chưa thấy đường request active tới Express middleware này. [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).

## Rủi ro theo chủ đề

| Chủ đề | Bằng chứng | Rủi ro/giới hạn kết luận | Hướng giảm thiểu |
|---|---|---|---|
| Quyền và dữ liệu cá nhân | Generic DB thiếu policy; file/AI routes không đồng nhất | Có thể đọc/ghi vượt scope nếu session hợp lệ; chưa chứng minh khai thác live | Route matrix, IDOR/scope tests, audit append-only, default deny |
| Race và mất dữ liệu | PCN/PGD có transaction/locks ở các boundary chính | Không có concurrency test với DB hoặc lỗi mạng thật | Test hai request đồng thời, idempotency/replay, stale cycle conflict và compensation |
| Upload/export | Multipart buffer, parser advisories; private storage metadata | Resource exhaustion/parser flaws; file signature không chứng minh file an toàn | Byte cap trước parse, ZIP expanded limits, private download auth, malware/content policy |
| AI | Dedicated review có hướng read-only; generic routes khác biệt | Hallucination, prompt injection trong tài liệu, dữ liệu gửi provider, quota; chưa có golden eval | Cấp context server-side, citation/evidence, no auto-mutation, provider/privacy policy và bộ eval synthetic |
| Workflow/integration | PCN snapshot; PGD gates; template PGD chưa nối runtime; sample routes có idempotency/reconcile surfaces | Chưa kiểm chứng với PTN thật, webhook/retry hoặc dữ liệu cũ | Contract tests, mapping/version, outbox/replay policy, manual reconciliation |
| UX/mobile | Dashboard work-first có static tests; browser QA thuộc branch riêng | Không thể kết luận overflow/tính tiện dụng trên master | Visual QA synthetic, viewport matrix, task completion review |
| Performance/ops | Lint/build pass; không load/staging | Không có baseline latency, quota, backup/restore runtime | Staging load, metrics, error budget, restore rehearsal có phê duyệt riêng |

## Thứ tự đề xuất và quick wins

1. **Access boundary:** trước mọi thay đổi UI, chốt ma trận scope/role và bảo vệ route generic + API không auth. Chạy tests request-level với DB test cô lập.
2. **Parser/dependency:** so sánh worktree security với master; chốt path reachable, cập nhật dependency có bản vá, giới hạn upload trước parse.
3. **PGD runtime workflow:** xác nhận kỳ vọng của quản trị viên; nếu template là nguồn runtime, pin version snapshot cho hồ sơ mới, giữ compatibility cho hồ sơ cũ.
4. **Sample/lab reconciliation:** xác minh hợp đồng với PTN và retry/error semantics trước khi thay schema hoặc trạng thái.
5. **DOCX/PDF + AI:** so khớp template nghiệp vụ và chính sách dữ liệu provider; chỉ đánh giá bằng dữ liệu synthetic/được phép.
6. **Superneat UX:** chọn worktree sau review gate; chuyển thành từng spec/plan/implementation riêng và chạy visual QA trên baseline đã tích hợp.

Quick wins không cần đổi kiến trúc: thêm contract tests cho route guard hiện hành; đánh dấu legacy API rõ profile; ghi lại dependency reachable; và xác định ai có quyền đọc activity summary.

## Câu hỏi cần chủ nghiệp vụ/vận hành trả lời

1. Các route KQTN PDF, extract-radimation và Gemini legacy có còn phục vụ người dùng/profile nào không? Nếu có, owner và thời hạn ngừng là gì?
2. Template workflow PGD có phải cấu hình runtime bắt buộc cho từng hồ sơ như mô tả trong design.md, hay chỉ là bề mặt quản trị tương lai?
3. Role nào được đọc danh sách users, activity audit và customer directory trong từng scope? Quyền manager của PGD/PCN có khác nhau không?
4. Những loại dữ liệu/tài liệu nào được phép gửi tới nhà cung cấp AI bên ngoài, có cần tắt AI theo hồ sơ không?
5. PTN nào là nguồn chuẩn cho mã mẫu/kết quả bên ngoài; retry, sửa kết quả, supersede và chữ ký/xác thực được vận hành ra sao?
6. Bộ DOCX/PDF nào là bản chuẩn cần nghiệm thu về font, bố cục, chữ ký, dấu và numbering?
7. Ưu tiên UX là bảng gọn responsive hay giữ bảng có cuộn ngang trên một số module? Ai nghiệm thu các viewport và thao tác thực địa?

## Worktree và trạng thái thay đổi

Không sửa hoặc dọn worktree. Trạng thái được ghi nhận trước khi tạo tài liệu audit:

| Đường dẫn | HEAD | Trạng thái |
|---|---:|---|
| E:/CODING/PGDCN_webapp | 90f98c9 | master; AGENTS.md và next.config.mjs dirty từ trước |
| C:/Users/HungX/.codex/worktrees/6842/PGDCN_webapp | 103343d | clean |
| C:/Users/HungX/AppData/Local/codex-with-chatgpt/codex-home/worktrees/1b56/PGDCN_webapp | a70fb2c | clean |
| C:/Users/HungX/AppData/Local/codex-with-chatgpt/codex-home/worktrees/7070/PGDCN_webapp | f3dc240 | clean |
| C:/Users/HungX/AppData/Local/codex-with-chatgpt/codex-home/worktrees/c990/PGDCN_webapp | 71f1c81 | untracked .temp/ |
| E:/CODING/_release_deploy_ccda521_wt_20261020 | ccda521 | clean |
| E:/CODING/_release_deploy_eada456 | f7e5484 | clean |
| E:/CODING/_release_deploy_eede8c2 | eede8c2 | clean |
| E:/CODING/_release_finalize_20261020 | affe8d7 | modified next-env.d.ts; untracked .temp/ |
| E:/CODING/_release_gate_71f1c813_20261020 | eada456 | modified next-env.d.ts; untracked .temp/ |
| E:/CODING/_release_task4_d8dbcf0 | d8dbcf0 | modified next-env.d.ts; untracked .temp/ |
| E:/CODING/_release_task_ccda521_wt_20261020 | ccda521 | untracked .temp/ |
| E:/CODING/_release_verified_eada456 | eada456 | modified next-env.d.ts; untracked .temp/ |
| E:/CODING/_release_verified_eede8c2 | eede8c2 | modified next-env.d.ts; untracked .temp/ |
| E:/CODING/_task4_role_review_fix | ccda521 | clean |
| E:/CODING/PCN_webapp/.worktrees/dossier-mobile-ux | prunable | gitdir target missing |
| E:/CODING/PCN_webapp/.worktrees/pgd-dossier-workspace | prunable | gitdir target missing |
| E:/CODING/PCN_webapp/.worktrees/pgd-pcn-form-modal-ux | prunable | gitdir target missing |
| E:/CODING/PGDCN_webapp/.worktrees/pgdcn-compact-worktable-20261021 | 0301bcc | clean; branch riêng, chưa tích hợp |
| E:/CODING/PGDCN_webapp/.worktrees/pgdcn-compact-worktable-integration-d7-20261021 | 0301bcc | untracked .temp/ và docs/ux/2026-10-21-compact-worktable-d7-source-integration-gate.md |
| E:/CODING/PGDCN_webapp/.worktrees/pgdcn-compact-worktable-qa-20261021 | 61e0088 | clean; branch riêng |
| E:/CODING/PGDCN_webapp/.worktrees/pgdcn-workfirst-ux-20261020 | 75e36ab | untracked .playwright-cli/, .temp/ và hai ảnh QA trong docs/releases/2026-10-21-task6b-pgd-dossier-qa/ |
| E:/CODING/PGDCN_webapp-checkpoint-c7591ca | 23c8a4e | clean |

Worktree security 71f1c81 có các commit thay đổi AdmZip/SheetJS và giới hạn ZIP Radimation sau common base f3dc240; chưa nằm trên master 90f98c9. Không đọc nội dung .temp hoặc ảnh QA.

## Lệnh kiểm tra và giới hạn

| Lệnh | Exit | Kết quả |
|---|---:|---|
| npm run lint | 0 | Script thực thi tsc --noEmit; typecheck thành công |
| npm test | 0 | 925 pass, 0 fail; test:pcn chọn file PCN và summary grid, không phải toàn bộ test suite |
| npm run test:all -- test/pgd-workflow.test.ts test/pgd-workflow-template.test.ts test/pgd-workflow-template-api-contract.test.ts test/pgd-intake-sample-boundary.test.ts test/pgd-document-api-contract.test.ts | 0 | 22 pass, 0 fail; test PGD/unit contracts đã chọn |
| npm run build | 0 | Next 16.3.7 compile, TypeScript, static page generation thành công; manifest liệt kê các API route đã nêu |
| npm audit --omit=dev | 1 | 17 findings: 2 critical, 10 high, 5 moderate |

Build tự cập nhật next-env.d.ts theo type route mới; file này đã được trả về trạng thái ban đầu. Không chạy npm audit fix, test:all toàn bộ, database query, migration apply/reset, Docker build, deploy, production request, import dữ liệu thật hoặc Storage write. npm test và build nạp môi trường .env theo cơ chế framework; không đọc/hiển thị giá trị biến. Các test đã chạy là test được yêu cầu, không phải kiểm thử end-to-end với dịch vụ thật.

## Đề xuất thiết kế liên quan

- [Ranh giới truy cập và audit](../superpowers/specs/2026-10-22-pgdcn-access-and-audit-boundaries-design.md)
- [Workflow và vòng đời hồ sơ](../superpowers/specs/2026-10-22-pgdcn-workflow-and-case-lifecycle-design.md)
- [Mẫu và kết quả PTN](../superpowers/specs/2026-10-22-pgdcn-samples-and-lab-results-design.md)
- [Tài liệu, AI và Storage](../superpowers/specs/2026-10-22-pgdcn-documents-ai-and-storage-design.md)
- [UX work-first superneat](../superpowers/specs/2026-10-22-pgdcn-workfirst-superneat-ux-design.md)

Các tài liệu liên kết là proposal chờ duyệt. Chưa có quyết định thiết kế lâu dài nào được phê duyệt và chưa có implementation plan.
