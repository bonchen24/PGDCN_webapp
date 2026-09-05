from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import unicodedata
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DESKTOP = Path(r"C:\Users\HungX\Desktop")
DEFAULT_REVIEW = DEFAULT_DESKTOP / "PCN_PGD_Template_Review_2026-09-05"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
FORM_ALIASES = (
    ("BMQT09015", "PCN", "PCN_Bia_ho_so.docx", "DOSSIER_COVER"),
    ("BMQT09012", "PCN", "PCN_Phan_cong_chung_nhan.docx", "ASSIGNMENT_FORM"),
    ("BMQT09013", "PCN", "PCN_Bien_ban_kiem_tra_hien_truong.docx", "FIELD_INSPECTION"),
    ("BMQT09010", "PCN", "PCN_Bien_ban_ma_hoa_mau.docx", "SAMPLE_CODING"),
    ("BMQT09009A", "PCN", "PCN_Bao_cao_danh_gia_CNSP.docx", "EVALUATION_REPORT"),
    ("BMQT09009", "PCN", "PCN_Bao_cao_danh_gia_CNSP.docx", "EVALUATION_REPORT"),
    ("BMQT09005", "PCN", "PCN_Bao_cao_KQTN.docx", "TEST_REPORT"),
    ("BMQT09004", "PCN", "PCN_Bien_ban_giao_nhan_mau.docx", "SAMPLE_HANDOVER"),
    ("BMQT09003", "PCN", "PCN_Bien_ban_lay_mau.docx", "SAMPLE_TAKING"),
    ("BMQT09002", "PCN", "PCN_Ke_hoach_danh_gia_CNSP.docx", "EVALUATION_PLAN"),
    ("BMQT0605A", "PCN", "PCN_De_nghi_chung_nhan.docx", "PROPOSAL_FORM"),
    ("BMQT0804", "PGD", "PGD-BM-12.docx", "FIELD_ACTIVITY_LOG"),
    ("BMQT0803", "PGD", "PGD-BM-03.docx", "INSPECTION_PLAN"),
    ("BMQT0802", "PGD", "PGD-BM-03.docx", "INSPECTION_PLAN"),
    ("BMGD0901", "PGD", "PGD-BM-05.docx", "SAMPLE_TAKING"),
    ("BMGD0725", "PGD", "PGD-BM-04.docx", "FIELD_INSPECTION"),
    ("BMGD0722", "PGD", "PGD-BM-10.docx", "DOSSIER_COVER"),
    ("BMGD0720", "PGD", "PGD-BM-11.docx", "CASE_TIMELINE"),
    ("BMGD0719", "PGD", "BM-GĐ-07.19.docx", "INSPECTION_CERTIFICATE"),
    ("BMQD0303A", "PCN", "PCN_Giay_chung_nhan.docx", "CERTIFICATE"),
    ("BMQD0301", "PCN", "PCN_Quyet_dinh.docx", "DECISION"),
    ("BMQT0302A", "PCN", "PCN_Giay_chung_nhan.docx", "CERTIFICATE"),
)

SOURCE_DIRS = (
    ("PCN", r"PCN\Hồ sơ chứng nhận QCVN4 2026\Biểu mẫu biên bản thực hiện"),
    ("PCN", r"PCN\Hồ sơ chứng nhận QCVN9 2026\Biểu mẫu"),
    ("PCN", r"PCN\Hồ sơ chứng nhận QCVN4 2026\Công văn"),
    ("PCN", r"PCN\Hồ sơ chứng nhận QCVN9 2026\Biểu mẫu công văn"),
    ("PCN", r"PCN\Hồ sơ chứng nhận QCVN4 2026\Mẫu BB trả, nhận mẫu"),
    ("PCN", r"PCN\Hồ sơ chứng nhận QCVN4 2026\Phiếu yêu cầu"),
    ("PGD", r"PGD\BM Giám định thép"),
    ("PGD", r"PGD\BM Hồ sơ thép ko gỉ"),
    ("PGD", r"PGD\Giám định\Hợp chuẩn thép\Biểu mẫu"),
    ("PGD", r"PGD\Giám định\Mẫu biên bản"),
)

PCN_RUNTIME_KINDS = {
    "DOSSIER_COVER",
    "PROPOSAL_FORM",
    "ASSIGNMENT_FORM",
    "EVALUATION_PLAN",
    "FIELD_INSPECTION",
    "SAMPLE_TAKING",
    "SAMPLE_CODING",
    "EVALUATION_REPORT",
    "SAMPLE_HANDOVER",
    "SAMPLE_RETURN",
    "LAB_REQUEST",
}


def normalize_code(value: str) -> str:
    ascii_value = unicodedata.normalize("NFD", value or "")
    ascii_value = "".join(char for char in ascii_value if unicodedata.category(char) != "Mn")
    return re.sub(r"[^A-Z0-9]", "", ascii_value.upper())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def docx_inspection(path: Path) -> dict:
    placeholders: set[str] = set()
    media: dict[str, str] = {}
    tables: list[dict] = []
    with ZipFile(path, "r") as archive:
        names = archive.namelist()
        xml_parts = [name for name in names if name.startswith("word/") and name.endswith(".xml")]
        xml = "\n".join(archive.read(name).decode("utf-8", "ignore") for name in xml_parts)
        for match in re.finditer(r"\[\[\s*([^\[\]]+?)\s*\]\]", xml):
            placeholders.add(match.group(1).strip())
        for name in names:
            if name.startswith("word/media/") and not name.endswith("/"):
                media[name] = hashlib.sha256(archive.read(name)).hexdigest()
        document_xml = archive.read("word/document.xml").decode("utf-8", "ignore")

    for table_xml in re.findall(r"<w:tbl(?:\s[^>]*)?>[\s\S]*?</w:tbl>", document_xml):
        grid = [int(width) for width in re.findall(r"<w:gridCol[^>]*w:w=\"(\d+)\"", table_xml)]
        table_width = re.search(r"<w:tblW[^>]*w:w=\"(\d+)\"", table_xml)
        indent = re.search(r"<w:tblInd[^>]*w:w=\"(-?\d+)\"", table_xml)
        fixed = bool(re.search(r"<w:tblLayout[^>]*w:type=\"fixed\"", table_xml))
        tables.append({
            "widthTwips": int(table_width.group(1)) if table_width else None,
            "indentTwips": int(indent.group(1)) if indent else None,
            "gridTwips": grid,
            "gridTotalTwips": sum(grid),
            "fixedLayout": fixed,
        })

    return {
        "byteSize": path.stat().st_size,
        "sha256": sha256(path),
        "placeholderKeys": sorted(placeholders),
        "media": media,
        "tables": tables,
    }


def source_form_mapping(file_name: str):
    compact = normalize_code(file_name)
    for alias, domain, runtime_file, generation_kind in FORM_ALIASES:
        if alias in compact:
            return {"formCode": alias, "domain": domain, "runtimeFile": runtime_file, "generationKind": generation_kind}
    return None


def looks_filled_example(file_name: str) -> bool:
    normalized = normalize_code(file_name)
    hints = ("TAJIMA", "PT5", "IEMM23", "NEWEST", "260720", "0583", "0134", "0237", "VIETMAU")
    return any(hint in normalized for hint in hints)


def source_status(path: Path, mapping: dict | None) -> tuple[str, str]:
    if path.name.startswith("~$"):
        return "DUPLICATE_OR_OLDER", "File khóa Office, không phải template nguồn."
    if looks_filled_example(path.name):
        return "FILLED_EXAMPLE", "Tên file cho thấy đây là hồ sơ/bản đã điền hoặc bản thử nghiệm."
    if mapping and path.suffix.lower() == ".doc":
        return "DUPLICATE_OR_OLDER", "Bản DOC legacy tương ứng với template DOCX runtime."
    if mapping:
        return "DESKTOP_EXTRA", "Có mã nghiệp vụ nhưng chưa được chọn làm nguồn runtime canonical."
    return "NEEDS_REVIEW", "Không nhận diện được mã biểu mẫu canonical từ tên file."


def inventory_sources(desktop: Path) -> list[dict]:
    items: list[dict] = []
    for domain, relative in SOURCE_DIRS:
        folder = desktop / relative
        if not folder.exists() or not folder.is_dir():
            continue
        for path in sorted(folder.iterdir(), key=lambda item: item.name.casefold()):
            if not path.is_file() or path.suffix.lower() not in {".doc", ".docx"} or path.name.startswith("~$"):
                continue
            mapping = source_form_mapping(path.name)
            status, reason = source_status(path, mapping)
            item = {
                "domain": domain,
                "sourcePath": str(path),
                "relativeSourcePath": str(path.relative_to(desktop)),
                "fileName": path.name,
                "format": path.suffix.lower().lstrip("."),
                "status": status,
                "reason": reason,
                "byteSize": path.stat().st_size,
                "sha256": sha256(path),
                "formCode": mapping["formCode"] if mapping else None,
                "runtimeFile": mapping["runtimeFile"] if mapping else None,
                "generationKind": mapping["generationKind"] if mapping else None,
            }
            if path.suffix.lower() == ".docx":
                item["inspection"] = docx_inspection(path)
            else:
                item["warnings"] = ["DOC_LEGACY_FORMAT", "PLACEHOLDERS_NOT_READ"]
            items.append(item)
    return items


def manifest_entries(root: Path, domain: str) -> list[dict]:
    manifest_path = root / "templates" / domain.lower() / "manifest.json"
    return json.loads(manifest_path.read_text(encoding="utf-8"))["templates"]


def runtime_inventory(root: Path, domain: str) -> list[dict]:
    directory = root / "templates" / domain.lower()
    entries = manifest_entries(root, domain)
    by_file = {entry["fileName"]: entry for entry in entries}
    result: list[dict] = []
    seen_pgd_kinds: set[str] = set()
    for path in sorted(directory.glob("*.docx"), key=lambda item: item.name.casefold()):
        entry = by_file.get(path.name, {})
        inspection = docx_inspection(path)
        expected = sorted(set(entry.get("placeholderKeys", [])) | set(entry.get("requiredPlaceholderKeys", [])))
        actual = inspection["placeholderKeys"]
        missing = sorted(set(expected) - set(actual))
        if domain == "PCN":
            generation_kind = entry.get("generationKind")
            if entry.get("usage") == "REFERENCE_ONLY":
                runtime_use = "REFERENCE_ONLY"
            elif generation_kind in PCN_RUNTIME_KINDS:
                runtime_use = "RUNTIME_GENERATOR"
            else:
                runtime_use = "CATALOG_ONLY"
        else:
            kind = entry.get("kind")
            runtime_use = "DEFAULT_RUNTIME" if kind not in seen_pgd_kinds else "PACKAGED_ALTERNATIVE"
            seen_pgd_kinds.add(kind)
        result.append({
            "domain": domain,
            "fileName": path.name,
            "manifest": entry,
            "runtimeUse": runtime_use,
            "inspection": inspection,
            "placeholderMissing": missing,
            "placeholderUnexpected": sorted(set(actual) - set(expected)) if expected else [],
            "tableFailures": [
                table for table in inspection["tables"]
                if table["gridTotalTwips"] and table["gridTotalTwips"] > 9354
                or table["indentTwips"] not in (None, 0)
                or not table["fixedLayout"]
            ],
        })
    return result


def build_crosswalk(root: Path, desktop: Path) -> dict:
    sources = inventory_sources(desktop)
    runtime = runtime_inventory(root, "PCN") + runtime_inventory(root, "PGD")
    source_by_runtime: dict[str, list[dict]] = {}
    for source in sources:
        if source.get("runtimeFile"):
            source_by_runtime.setdefault(source["runtimeFile"], []).append(source)
    for item in runtime:
        item["desktopCandidates"] = [
            {
                "fileName": source["fileName"],
                "relativeSourcePath": source["relativeSourcePath"],
                "status": source["status"],
                "reason": source["reason"],
                "format": source["format"],
            }
            for source in source_by_runtime.get(item["fileName"], [])
        ]

    runtime_files = {item["fileName"] for item in runtime}
    extras = [source for source in sources if source.get("runtimeFile") not in runtime_files or not source.get("runtimeFile")]
    missing = [source for source in sources if source.get("runtimeFile") and source["runtimeFile"] not in runtime_files]
    return {
        "generatedAt": "2026-09-05",
        "root": str(root),
        "desktopRoot": str(desktop),
        "contentWidthMm": 165,
        "pageMarginsMm": {"top": 20, "bottom": 20, "left": 30, "right": 15},
        "summary": {
            "runtimePcnCount": sum(1 for item in runtime if item["domain"] == "PCN"),
            "runtimePgdCount": sum(1 for item in runtime if item["domain"] == "PGD"),
            "desktopSourceCount": len(sources),
            "desktopExtraOrReviewCount": len(extras),
            "desktopUnmappedCount": len(missing),
            "placeholderFailures": sum(len(item["placeholderMissing"]) for item in runtime),
            "tableFailures": sum(len(item["tableFailures"]) for item in runtime),
        },
        "runtimeTemplates": runtime,
        "desktopSources": sources,
        "desktopExtras": extras,
        "notes": [
            "Runtime chỉ sử dụng các file trong templates/pcn và templates/pgd; Desktop không phải runtime dependency.",
            "Các file DOC hoặc hồ sơ đã điền dữ liệu được giữ ở trạng thái tham chiếu, không thay thế trực tiếp vào runtime.",
            "[[grade]] được kiểm tra theo placeholder thực tế trong DOCX ở các form có trường Mác/model/cấp sản phẩm.",
        ],
    }


def copy_runtime_templates(root: Path, review: Path) -> None:
    for domain in ("pcn", "pgd"):
        target = review / domain.upper()
        target.mkdir(parents=True, exist_ok=True)
        source_dir = root / "templates" / domain
        for path in source_dir.glob("*.docx"):
            shutil.copy2(path, target / path.name)
        for name in ("manifest.json", "README.md"):
            source = source_dir / name
            if source.exists():
                shutil.copy2(source, target / name)


def write_readme(review: Path, crosswalk: dict) -> None:
    summary = crosswalk["summary"]
    reports = review / "reports"
    lines = [
        "# Bộ biểu mẫu PCN/PGD dùng để kiểm tra",
        "",
        "Bộ này là bản sao kiểm tra, không ghi đè các file nguồn trên Desktop.",
        "",
        f"- Template runtime PCN: {summary['runtimePcnCount']} file.",
        f"- Template runtime PGD: {summary['runtimePgdCount']} file.",
        f"- Nguồn biểu mẫu Desktop đã kiểm kê: {summary['desktopSourceCount']} file DOC/DOCX.",
        f"- Placeholder thiếu trong runtime: {summary['placeholderFailures']}.",
        f"- Bảng vượt lề/thụt lề/chưa fixed layout: {summary['tableFailures']}.",
        "",
        "## Cách đọc thư mục",
        "",
        "- `PCN/`: bản PCN canonical đã chuẩn hóa; bảng nằm trong vùng nội dung 165 mm.",
        "- `PGD/`: bản PGD canonical đã chuẩn hóa; các trường Mác/model/cấp sản phẩm dùng placeholder `[[grade]]` khi có nhãn tương ứng.",
        "- `reports/template-crosswalk.json`: đối chiếu file runtime với nguồn Desktop, placeholder, media và trạng thái sử dụng.",
        "",
        "## Nguyên tắc phân loại",
        "",
        "File DOC legacy, file có dữ liệu hồ sơ, file khóa hoặc bản trùng không được đưa vào runtime. Các mã Desktop trùng nghiệp vụ với template hiện có được ghi nhận là tham chiếu/bản cũ trong báo cáo.",
        "",
        "## Kiểm tra bảng",
        "",
        "Mỗi bảng được đặt trong vùng rộng tối đa 165 mm, canh từ lề trái 30 mm đến lề phải 15 mm, có layout cố định và phân bổ cột theo nội dung thay vì chia đều máy móc.",
    ]
    (reports / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Đối chiếu template PCN/PGD với nguồn Desktop và xuất bộ kiểm tra.")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--desktop", type=Path, default=DEFAULT_DESKTOP)
    parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    args = parser.parse_args()
    root = args.root.resolve()
    desktop = args.desktop.resolve()
    review = args.review.resolve()
    crosswalk = build_crosswalk(root, desktop)
    reports = review / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    copy_runtime_templates(root, review)
    (reports / "template-crosswalk.json").write_text(json.dumps(crosswalk, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_readme(review, crosswalk)
    print(json.dumps({"review": str(review), "summary": crosswalk["summary"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
