const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const repo = path.resolve(dir, '../../../');
const diagrams = [
  ['00-master', 'Bản đồ vận hành toàn app', 'Tổng quan xuyên suốt từ tiếp nhận đến bàn giao/lưu trữ, PCN, PGD, PTN, phê duyệt, AI và nền tảng.', 'architecture', ['cross', 'pcn', 'pgd', 'platform']],
  ['01-navigation', '13 đích điều hướng và shell Superneat', 'Phân nhóm shared, PCN, PGD, admin; permission gate, route, module quick peek chỉ đọc.', 'tree', ['navigation', 'pcn', 'pgd', 'platform']],
  ['02-pcn-intake-assignment', 'PCN · Đề xuất, hồ sơ và phân công', 'Kiểm tra intake, tạo dossier/checklist/snapshot trong transaction, phân công và tự nhận có gate.', 'workflow', ['pcn']],
  ['03-pcn-dynamic-workflow', 'PCN · Workflow cấu hình động', 'Template đã publish, runtime node/edge, nhánh điều kiện, split/join, trả sửa và các bước phát hành.', 'workflow', ['pcn']],
  ['04-pgd-12-steps', 'PGD · Đúng 12 nhiệm vụ', '12 task vận hành trong 5 chặng nghiệp vụ, role gates, lab result và quay lại khi thiếu/chưa đạt.', 'architecture', ['pgd']],
  ['05-documents-and-templates', 'Hồ sơ tài liệu, DOCX và workflow templates', 'Phân biệt requirement, trạng thái file, version, xác nhận/miễn trừ, nguồn template và publish workflow.', 'architecture', ['cross', 'pcn', 'pgd']],
  ['06-samples-and-lab', 'PCN sample và tích hợp PTN', 'Lô/mẫu, bundle PYC, DDT/HSNL, ACK theo PTN/mẫu, retry/reconcile; tuyến intake PGD độc lập.', 'architecture', ['cross', 'pcn', 'pgd', 'external']],
  ['07-pgd-evidence-approval-package', 'PGD · Evidence, review, ký và package', 'Manifest completeness, technical review, hai chặng approval, manifest hash, ký và ZIP; tách archive/handover.', 'architecture', ['pgd']],
  ['08-auth-rbac', 'Đăng nhập, quyền và phạm vi', 'Ranh giới UI/API, vai trò, department scope, PCN/PGD owner/workflow grants và các nhánh từ chối.', 'architecture', ['cross', 'pcn', 'pgd', 'platform']],
  ['09-ai-ocr', 'AI review và OCR hỗ trợ', '11 tiêu chí PGD advisory, liên kết evidence, OCR, Gemini tùy chọn, fallback và lỗi dịch vụ.', 'architecture', ['cross', 'pcn', 'pgd', 'external']],
  ['10-system-architecture', 'Kiến trúc runtime và biên tích hợp', 'Next.js/React, API, PostgreSQL/Supabase, private Storage, PTN ngoài, AI ngoài và container.', 'architecture', ['platform', 'external', 'cross']],
  ['11-data-lineage', 'Data lineage từ intake đến lưu trữ', 'Đường đi dữ liệu PCN/PGD, artifact, sample, KQTN, review, phát hành; phân biệt read/write và external.', 'dataflow', ['cross', 'pcn', 'pgd', 'data']],
  ['12-data-model-erd', 'ERD vật lý có khai báo trong SQL', 'Bảng app_documents và file_assets, khóa/unique keys và quan hệ logical JSONB; không suy diễn FK.', 'erd', ['data', 'platform']],
  ['13-audit-notifications', 'Activity log, audit và notification', 'Append-only audit path, event sources, notification badge/list, API filters và error states.', 'architecture', ['cross', 'platform']],
  ['14-customers-and-work-queues', 'Customer CRUD/import và work queues', 'Customer validation/dedupe/import preview-apply, PCN register, PGD queues và projection dashboard.', 'architecture', ['cross', 'pcn', 'pgd']],
  ['15-deployment-security', 'Deployment topology, health và secrets', 'Docker webapp:2357, external Supabase network, health checks, secret boundary và private bytes.', 'architecture', ['platform', 'external']],
  ['16-sequence-pcn-create', 'Sequence · Tạo PCN dossier', 'UI → API intake → validate → template snapshot → dossier + checklist transaction → owner state.', 'sequence', ['sequence', 'pcn']],
  ['17-sequence-document-upload-attach', 'Sequence · Upload và attach DOCX', 'Upload binary, persist asset/version, update requirement pointer; generated draft có flow confirm riêng.', 'sequence', ['sequence', 'pcn']],
  ['18-sequence-pgd-pyc-kqtn', 'Sequence · PGD PYC đến KQTN', 'Tiếp nhận PYC, tạo lab request, nhận kết quả, review và evidence gate; transport callback chưa xác minh.', 'sequence', ['sequence', 'pgd', 'external']],
  ['19-sequence-pcn-approval-release', 'Sequence · PCN phê duyệt và release', 'Approval step, issue, delivery và archive là các hành động/API riêng có gate.', 'sequence', ['sequence', 'pcn']],
];

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allSources = new Map();
const cards = diagrams.map(([id, title, summary, type, tags]) => {
  const candidateFile = `${id}.candidate.json`;
  const artifactFile = `${id}.html`;
  const summaryFile = `${id}.finalize-summary.json`;
  const candidate = JSON.parse(fs.readFileSync(path.join(dir, candidateFile), 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(path.join(dir, summaryFile), 'utf8'));
  const specificationHash = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dir, candidateFile))).digest('hex');
  const valid = receipt.ok === true && Object.values(receipt.gates || {}).every(v => v === 'pass') && receipt.specification?.sha256 === specificationHash && fs.existsSync(path.join(dir, artifactFile));
  const collections = ['components', 'nodes', 'participants', 'entities', 'states'];
  const nodes = collections.flatMap(key => candidate[key] || []);
  const edgeCount = ['connections', 'transitions', 'messages', 'relationships'].reduce((n, key) => n + (candidate[key]?.length || 0), 0);
  for (const node of nodes) for (const source of node.sources || []) {
    const key = `${source.path}:${source.line}${source.end_line && source.end_line !== source.line ? `-${source.end_line}` : ''}`;
    if (!allSources.has(key)) allSources.set(key, new Set());
    allSources.get(key).add(id);
  }
  return { id, title, summary, type, tags, valid, nodes: nodes.length, edges: edgeCount, candidateTitle: candidate.meta?.title || candidate.meta?.name || id };
});

let sourceProblems = [];
for (const diagram of diagrams) {
  const [id] = diagram;
  const candidate = JSON.parse(fs.readFileSync(path.join(dir, `${id}.candidate.json`), 'utf8'));
  const nodes = ['components', 'nodes', 'participants', 'entities', 'states'].flatMap(key => candidate[key] || []);
  for (const node of nodes) {
    if (!Array.isArray(node.sources) || node.sources.length === 0) sourceProblems.push(`${id}/${node.id || node.name}: thiếu source pointer`);
    for (const source of node.sources || []) {
    const file = path.join(repo, source.path);
    if (!fs.existsSync(file)) { sourceProblems.push(`${id}: thiếu ${source.path}`); continue; }
    const lineCount = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
    if (source.line < 1 || source.line > lineCount || (source.end_line && source.end_line > lineCount)) sourceProblems.push(`${id}: ngoài phạm vi ${source.path}:${source.line}-${source.end_line || source.line} (file ${lineCount} dòng)`);
    }
  }
}
if (sourceProblems.length) throw new Error(`Source evidence không hợp lệ:\n${sourceProblems.join('\n')}`);
if (cards.some(card => !card.valid)) throw new Error(`Có diagram chưa qua đủ finalize gates: ${cards.filter(card => !card.valid).map(card => card.id).join(', ')}`);

const cardHtml = cards.map(card => `<article class="card" data-tags="${esc(card.tags.join(' '))}" data-search="${esc(`${card.id} ${card.title} ${card.summary} ${card.type} ${card.tags.join(' ')}`.toLocaleLowerCase('vi'))}">
  <div class="card-top"><span class="number">${esc(card.id.slice(0, 2))}</span><span class="type">${esc(card.type)}</span><span class="pass">PASS</span></div>
  <h2>${esc(card.title)}</h2><p>${esc(card.summary)}</p>
  <div class="meta">${card.nodes} thành phần · ${card.edges} liên kết</div>
  <div class="tags">${card.tags.map(tag => `<span>${esc(tag.toUpperCase())}</span>`).join('')}</div>
  <div class="actions"><a class="primary" href="./${esc(card.id)}.html">Mở diagram ↗</a><a href="./${esc(card.id)}.candidate.json">Candidate JSON</a><a href="./${esc(card.id)}.finalize-summary.json">Receipt</a></div>
</article>`).join('\n');

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PGDCN · Full System Atlas</title>
<style>
:root{color-scheme:light;--ink:#122033;--muted:#617187;--line:#dce4ed;--paper:#f4f7fb;--card:#fff;--blue:#1456a0;--green:#16734c;--navy:#0e2036}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 "Segoe UI",Arial,sans-serif}a{color:inherit}header{background:linear-gradient(130deg,#0e2036,#173b5e 65%,#12634b);color:white;padding:48px max(24px,calc((100% - 1240px)/2)) 38px}header .eyebrow{color:#b9d9f3;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}h1{font-size:clamp(30px,5vw,50px);line-height:1.1;margin:12px 0 12px;letter-spacing:-.035em}header p{max-width:850px;color:#deebf6;margin:0}.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:25px}.stat{border:1px solid #ffffff3a;border-radius:12px;padding:12px 16px;min-width:135px;background:#ffffff0c}.stat b{display:block;font-size:21px}.stat span{font-size:12px;color:#c6d9eb}.wrap{max-width:1240px;margin:auto;padding:28px 24px 64px}.notice{background:#fff;border:1px solid var(--line);border-left:4px solid #128255;border-radius:10px;padding:14px 17px;color:#35485e;margin:0 0 22px}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:22px 0}.search{flex:1;min-width:245px;padding:12px 14px;border:1px solid #c8d4e0;border-radius:9px;background:white;font:inherit}.filters{display:flex;gap:7px;flex-wrap:wrap}.filters button{border:1px solid #cbd6e1;background:white;color:#30445a;padding:9px 12px;border-radius:999px;font:700 12px inherit;cursor:pointer}.filters button[aria-pressed=true]{background:#173b5e;color:white;border-color:#173b5e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:15px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:0 5px 16px #18334d08;display:flex;flex-direction:column;min-height:260px}.card[hidden]{display:none}.card-top{display:flex;align-items:center;gap:8px}.number{background:#edf3f8;color:#1e4669;font-weight:900;border-radius:7px;padding:3px 8px}.type{font-size:11px;color:#627388;background:#f1f4f7;padding:3px 8px;border-radius:999px}.pass{margin-left:auto;color:#116746;background:#e7f6ee;border:1px solid #c7ebd5;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.07em;padding:4px 8px}.card h2{font-size:19px;line-height:1.25;margin:14px 0 7px}.card p{color:#586a7e;margin:0 0 12px;flex:1}.meta{font-size:12px;font-weight:700;color:#485e75}.tags{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0}.tags span{font-size:9px;letter-spacing:.06em;color:#465d72;border:1px solid #e1e8ef;border-radius:999px;padding:3px 7px}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.actions a{font-size:12px;text-decoration:none;border:1px solid #d8e1ea;border-radius:7px;padding:7px 9px;color:#36516a}.actions a.primary{background:#173b5e;color:white;border-color:#173b5e;font-weight:800}.foot{margin-top:27px;border-top:1px solid var(--line);padding-top:19px;color:#64758a;font-size:13px}.foot a{color:#26567d;margin-right:16px}.empty{display:none;background:white;border:1px dashed #bdcbd9;border-radius:12px;padding:28px;text-align:center;color:#66788d}.empty.show{display:block}footer{max-width:1240px;padding:0 24px 36px;margin:auto;color:#738195;font-size:12px}@media(max-width:600px){header{padding-top:32px}.stat{min-width:calc(50% - 8px)}.wrap{padding:20px 14px 42px}}
</style></head><body>
<header><div class="eyebrow">PGDCN · CODE EVIDENCE ATLAS · MASTER ${esc('521f8d5')}</div><h1>Mô hình tương tác toàn hệ thống</h1><p>Atlas Archify gồm bản đồ liên kết và các diagram drill-down. Mỗi card mở một trang HTML độc lập, có thể xem offline; candidate JSON và receipt finalize đi kèm để kiểm tra nguồn và trạng thái build.</p>
<div class="stats"><div class="stat"><b>${cards.length}</b><span>diagram độc lập</span></div><div class="stat"><b>${cards.reduce((n,c)=>n+c.nodes,0)}</b><span>node / thành phần</span></div><div class="stat"><b>${cards.reduce((n,c)=>n+c.edges,0)}</b><span>edge / liên kết</span></div><div class="stat"><b>${cards.filter(c=>c.valid).length}/${cards.length}</b><span>finalize + browser PASS</span></div></div></header>
<main class="wrap"><div class="notice"><strong>Phạm vi evidence:</strong> đối chiếu source tại commit <code>521f8d517560f3767321c19ad492658bb507b4b4</code>. Tên menu/route và flow thể hiện trong code; các điểm chưa tìm được adapter callback, handover API hoặc physical FK được ghi rõ trong <a href="./coverage-matrix.md">ma trận coverage</a>.</div>
<div class="toolbar"><input id="search" class="search" type="search" placeholder="Tìm theo module, API, role, domain…" aria-label="Tìm diagram"><div class="filters" role="group" aria-label="Lọc diagram">${['all','pcn','pgd','cross','platform','data','sequence','external','navigation'].map((tag,i)=>`<button type="button" data-filter="${tag}" aria-pressed="${i===0?'true':'false'}">${tag==='all'?'Tất cả':tag.toUpperCase()}</button>`).join('')}</div></div>
<section id="grid" class="grid" aria-label="Diagram atlas">${cardHtml}</section><div id="empty" class="empty">Không có diagram phù hợp. Hãy đổi từ khóa hoặc bộ lọc.</div>
<div class="foot"><a href="./README.md">README & phạm vi</a><a href="./coverage-matrix.md">Coverage matrix</a><a href="./source-evidence.md">Source evidence ledger</a><span>Archify 3.1.0 · trang mở diagram dùng viewer tự chứa.</span></div></main><footer>File index này không gọi API, không truy cập dữ liệu ứng dụng và không chứa dữ liệu khách hàng/mẫu thực.</footer>
<script>(()=>{const cards=[...document.querySelectorAll('.card')],q=document.querySelector('#search'),buttons=[...document.querySelectorAll('[data-filter]')],empty=document.querySelector('#empty');let filter='all';function update(){const term=q.value.trim().toLocaleLowerCase('vi');let shown=0;for(const c of cards){const okText=c.dataset.search.includes(term);const okFilter=filter==='all'||c.dataset.tags.split(' ').includes(filter);c.hidden=!(okText&&okFilter);if(!c.hidden)shown++}empty.classList.toggle('show',shown===0)}q.addEventListener('input',update);buttons.forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update()}))})();</script></body></html>`;
fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');

const evidenceLines = [
  '# Source evidence ledger', '',
  'Snapshot: commit 521f8d517560f3767321c19ad492658bb507b4b4 on branch master. Candidate sources are checked against the isolated authoring worktree before index generation.',
  'Node/participant/entity/state source pointers are embedded in each `.candidate.json`. Archify 3.1 does not attach `sources` to architecture connections; edge assertions below use the same diagram candidates and are resolved through these grouped source pointers.', ''
];
for (const [id, title] of diagrams) {
  const sources = [...allSources.entries()].filter(([, ids]) => ids.has(id)).sort(([a], [b]) => a.localeCompare(b));
  evidenceLines.push(`## ${id} · ${title}`, '');
  for (const [key] of sources) {
    const match = key.match(/^(.*):(\d+)(?:-(\d+))?$/);
    const [, file, line, end] = match;
    const display = end ? `${file}:${line}-${end}` : `${file}:${line}`;
    evidenceLines.push(`- [\`${display}\`](../../../${file}#L${line})`);
  }
  evidenceLines.push('');
}
fs.writeFileSync(path.join(dir, 'source-evidence.md'), evidenceLines.join('\n'), 'utf8');
console.log(`Generated index.html and source-evidence.md for ${cards.length} diagrams; nodes=${cards.reduce((n, card) => n + card.nodes, 0)}; edges=${cards.reduce((n, card) => n + card.edges, 0)}; source issues=0; all finalize gates=PASS.`);
