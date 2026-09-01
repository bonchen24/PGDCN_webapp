"""Authoring-only normalizer for the checked-in PCN DOCX pack.

This script deliberately operates on the repository template assets only. It
does not discover, watch, import, or retain a path to any research folder and
is never imported by the Next.js runtime.
"""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "templates" / "pcn" / "manifest.json"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"
ET.register_namespace("w", W_NS)


def node_text(node: ET.Element) -> str:
    return "".join(item.text or "" for item in node.iter(f"{W}t"))


def add_run(paragraph: ET.Element, text: str) -> None:
    source_run = next(paragraph.iter(f"{W}r"), None)
    run = ET.Element(f"{W}r")
    if source_run is not None:
        run_properties = source_run.find(f"{W}rPr")
        if run_properties is not None:
            run.append(ET.fromstring(ET.tostring(run_properties, encoding="unicode")))
    text_node = ET.SubElement(run, f"{W}t")
    text_node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    text_node.text = text
    paragraph.append(run)


def append_after(root: ET.Element, needles: tuple[str, ...], placeholder: str) -> bool:
    for paragraph in root.iter(f"{W}p"):
        if placeholder in node_text(paragraph):
            return True
        paragraph_text = node_text(paragraph)
        if any(needle in paragraph_text for needle in needles):
            add_run(paragraph, f" {placeholder}")
            return True
    return False


def replace_in_xml(xml: str, replacements: dict[str, str]) -> str:
    for old, new in replacements.items():
        xml = xml.replace(old, new)
    return xml


def remove_generated_union_tables(root: ET.Element) -> None:
    parents = {child: parent for parent in root.iter() for child in parent}
    for table in list(root.iter(f"{W}tbl")):
        text = node_text(table)
        if "Trường dữ liệu" in text or "Placeholder bắt buộc" in text:
            parent = parents.get(table)
            if parent is not None:
                parent.remove(table)


def remove_orphaned_union_labels(root: ET.Element) -> None:
    parents = {child: parent for parent in root.iter() for child in parent}
    for paragraph in list(root.iter(f"{W}p")):
        if "THÔNG TIN ĐIỀN TỰ ĐỘNG TỪ HỒ SƠ PCN" not in node_text(paragraph):
            continue
        parent = parents.get(paragraph)
        if parent is not None:
            parent.remove(paragraph)


def remove_example_rows(root: ET.Element) -> None:
    parents = {child: parent for parent in root.iter() for child in parent}
    for row in list(root.iter(f"{W}tr")):
        text = node_text(row)
        if any(marker in text for marker in ("IEMM 0007.", "CS- G318MS", "HEF-130R")):
            parent = parents.get(row)
            if parent is not None:
                parent.remove(row)


def replace_paragraph_texts(root: ET.Element) -> None:
    """Scrub sample values even when Word split them across several runs."""
    for paragraph in root.iter(f"{W}p"):
        text = node_text(paragraph)
        next_text = replace_in_xml(text, REPLACEMENTS)
        if next_text == text:
            continue
        text_nodes = list(paragraph.iter(f"{W}t"))
        if not text_nodes:
            continue
        text_nodes[0].text = next_text
        for text_node in text_nodes[1:]:
            text_node.text = ""


def normalize_split_placeholder(root: ET.Element, key: str) -> None:
    """Keep a placeholder in one Word text node when a source split its brackets."""
    placeholder = f"[[{key}]]"
    for paragraph in root.iter(f"{W}p"):
        text_nodes = list(paragraph.iter(f"{W}t"))
        if placeholder not in "".join(node.text or "" for node in text_nodes):
            continue
        if any(placeholder in (node.text or "") for node in text_nodes):
            continue
        joined = node_text(paragraph)
        text_nodes[0].text = joined
        for text_node in text_nodes[1:]:
            text_node.text = ""


def append_missing_keys(root: ET.Element, required: list[str], placements: dict[str, tuple[str, ...]]) -> None:
    for key in required:
        placeholder = f"[[{key}]]"
        if placeholder in node_text(root):
            continue
        needles = placements.get(key)
        if needles and append_after(root, needles, placeholder):
            continue
        # This is a last-resort field in the existing form, not a generic
        # union table. It keeps a manifest-required value renderable when a
        # source form has no dedicated labelled slot.
        body = root.find(f".//{W}body")
        if body is None:
            continue
        paragraph = ET.Element(f"{W}p")
        add_run(paragraph, f"Thông tin biểu mẫu: {placeholder}")
        sect_pr = body.find(f"{W}sectPr")
        if sect_pr is None:
            body.append(paragraph)
        else:
            body.insert(list(body).index(sect_pr), paragraph)


PLACEMENTS: dict[str, dict[str, tuple[str, ...]]] = {
    "pcn-assignment": {
        "so_dang_ky": ("Mã hồ sơ/Đề nghị", "Số Job"),
        "ten_cong_ty": ("Đơn vị yêu cầu",),
        "dia_chi_kho": ("Địa điểm lấy mẫu",),
        "ngay_lay_mau": ("Ngày giờ thực hiện",),
        "nguoi_danh_gia": ("Trưởng đoàn",),
        "tieu_chuan": ("Phương pháp/Tiêu chuẩn áp dụng",),
    },
    "pcn-evaluation-plan": {
        "ten_cong_ty": ("Tên khách hàng",),
        "tieu_chuan": ("Chuẩn mực đánh giá",),
        "method_label": ("Phương thức đánh giá",),
        "ngay_bat_dau": ("Ngày đánh giá",),
        "ngay_ket_thuc": ("Ngày đánh giá",),
    },
    "pcn-field-inspection": {
        "so_dang_ky": ("Mã hồ sơ.",),
        "ten_cong_ty": ("Tên doanh nghiệp/ khách hàng",),
        "dia_chi_kho": ("Địa chỉ:",),
        "loai_sp": ("Lô hàng hóa:",),
        "ngay_lay_mau": ("Thời gian, địa điểm đánh giá",),
        "tieu_chuan": ("Quy chuẩn kỹ thuật quốc gia",),
    },
    "pcn-sample-taking": {
        "so_dang_ky": ("Số/No:",),
        "loai_sp": ("Tên sản phẩm:",),
        "model": ("Tên sản phẩm:",),
        "nhan_hieu": ("Nhãn hiệu thương mại:",),
        "ten_cong_ty": ("Tổ chức sản xuất:",),
        "dia_chi_kho": ("Địa điểm lấy mẫu:",),
        "ma_lo": ("Ký hiệu", "mẻ/lô"),
        "seal_stamp": ("Tem niêm phong/Ký hiệu mã hóa",),
        "ma_mau": ("Tem niêm phong/Ký hiệu mã hóa",),
        "ngay_lay_mau": ("Ngày lấy mẫu", "ngày    "),
        "tieu_chuan": ("Yêu cầu thử nghiệm",),
    },
    "pcn-sample-coding": {
        "ma_lo": ("Mã hồ sơ/File No.",),
    },
    "pcn-sample-handover": {
        "so_pyc": ("Biên bản số",),
        "phong_thu_nghiem": ("Bên nhận",),
        "ngay_giao_mau": ("ngày",),
        "nguoi_nhan": ("Người nhận",),
    },
    "pcn-test-report": {
        "loai_sp": ("Tên sản phẩm",),
        "model": ("Hạng, kiểu, loại",),
        "tieu_chuan": ("Tiêu chuẩn dùng để đánh giá",),
        "so_pyc": ("Biên bản giao mẫu",),
        "so_bao_cao": ("Phiếu kết qủa thử nghiệm", "Phiếu kết quả thử nghiệm"),
        "ngay_kqtn": ("Phiếu kết qủa thử nghiệm", "Phiếu kết quả thử nghiệm"),
        "phong_thu_nghiem": ("của PTN",),
        "ket_qua": ("Đánh giá kết quả thử nghiệm",),
    },
    "pcn-evaluation-report": {
        "so_dang_ky": ("Mã hồ sơ/File No.",),
        "ten_cong_ty": ("Khách hàng",),
        "dia_chi_ct": ("Địa chỉ",),
        "loai_sp": ("Lô Sản phẩm chứng nhận",),
        "ma_lo": ("Lô Sản phẩm chứng nhận",),
        "tieu_chuan": ("Quy chuẩn chứng nhận",),
        "ngay_lap": ("Thời gian đánh giá/Audit Duration",),
        "nguoi_danh_gia": ("Thành viên đoàn đánh giá",),
        "nguoi_tham_xet": ("Chuyên gia thẩm xét",),
        "ket_qua": ("KẾT QUẢ ĐÁNH GIÁ",),
    },
    "pcn-certificate": {
        "ngay_cap_gcn": ("cấp ngày",),
    },
    "pcn-decision": {
        "so_quyet_dinh": ("Số:",),
        "ngay_qd": ("Hà Nội",),
    },
    "pcn-dossier-cover": {
        "so_dang_ky": ("MÃ HỒ SƠ",),
        "ten_cong_ty": ("Khách hàng",),
        "loai_sp": ("Hạng mục chứng nhận",),
        "field_code": ("Hạng mục chứng nhận",),
        "nguoi_danh_gia": ("Người thực hiện",),
    },
    "pcn-proposal": {
        "ten_cong_ty": ("Tên tổ chức, cá nhân",),
        "dia_chi_ct": ("Địa chỉ:",),
        "loai_sp": ("Tên hàng hóa, nhãn hiệu, kiểu loại",),
        "tieu_chuan": ("Tiêu chuẩn/Quy chuẩn đăng ký chứng nhận",),
        "so_dang_ky": ("Mã hồ sơ đăng ký",),
    },
}


REPLACEMENTS: dict[str, str] = {
    "Công ty TNHH XNK và Kinh doanh Thương mại Sun Shine Việt Nam": "[[ten_cong_ty]]",
    "Công ty TNHH XNK và Kinh doanh Thương mại Sun Shine": "[[ten_cong_ty]]",
    "[[ten_cong_ty]]TNHH XNK và Kinh doanh Thương mại Sun Shine Việt Nam": "[[ten_cong_ty]]",
    "Tên tổ chức, cá nhân: Công ty": "Tên tổ chức, cá nhân: [[ten_cong_ty]]",
    "Số Job": "Mã hồ sơ/Đề nghị",
    "Mã hồ sơ.: IEMM": "Mã hồ sơ.: [[so_dang_ky]]",
    "Ngày đánh giá: 01/6/2020": "Ngày đánh giá: [[ngay_bat_dau]]",
    "Phương thức đánh giá:  Phương thức 7": "Phương thức đánh giá: [[method_label]]",
    "Chuẩn mực đánh giá:   QCVN 4:2009/BKHCN và sửa đổi 1:2016": "Chuẩn mực đánh giá: [[tieu_chuan]]",
    "QCVN 4:2009/BKHCN và sửa đổi 1 QCVN 4:2009/BKHCN": "[[tieu_chuan]]",
    "QCVN 4:2009/BKHCN và sửa đổi 1:2016 QCVN  4:2009/BKHCN": "[[tieu_chuan]]",
    "TĐC": "PCN",
    "Điện áp…V, tần số: …Hz, Công suất: … W, dung tích …L ( ghi dõ các thông số trên tem chính sp": "[[thong_so_ky_thuat]]",
    "….Co., Ltd": "[[nha_san_xuat]]",
    "… cái/chiếc": "[[so_luong_mau]]",
    "Bếp điện từ, nhãn hiệu [[nhan_hieu]] model CS- G318MS": "[[loai_sp]] / [[nhan_hieu]] / [[model]]",
    "Quạt điện, nhãn [[nhan_hieu]], model HEF-130R": "[[loai_sp]] / [[nhan_hieu]] / [[model]]",
    "Hà Nội, ngày ….. tháng…..năm 2020": "Hà Nội, ngày [[ngay_lap]]",
    "Ngày   tháng  năm 2020": "Ngày [[ngay_lap]]",
    "ngày    05   tháng   04   năm 2023": "ngày [[ngay_lay_mau]]",
    "ngày……tháng…..năm ……": "ngày [[ngay_lap]]",
    "ngày……tháng……năm ……": "ngày [[ngay_lap]]",
}


def process(template: dict[str, object]) -> None:
    file_path = ROOT / "templates" / "pcn" / str(template["fileName"])
    with zipfile.ZipFile(file_path, "r") as source:
        members = {name: source.read(name) for name in source.namelist()}

    document_name = "word/document.xml"
    root = ET.fromstring(members[document_name])
    remove_generated_union_tables(root)
    remove_orphaned_union_labels(root)
    remove_example_rows(root)
    replace_paragraph_texts(root)
    members[document_name] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

    # Apply plain text scrubbing to all Word XML parts, then place canonical
    # fields in the main document based on the visible form labels.
    for name, content in list(members.items()):
        if name.startswith("word/") and name.endswith(".xml"):
            try:
                members[name] = replace_in_xml(content.decode("utf-8"), REPLACEMENTS).encode("utf-8")
            except UnicodeDecodeError:
                pass

    root = ET.fromstring(members[document_name])
    append_missing_keys(root, list(template["requiredPlaceholderKeys"]), PLACEMENTS.get(str(template["id"]), {}))
    normalize_split_placeholder(root, "ngay_qd")
    members[document_name] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

    temporary = file_path.with_suffix(".authoring.tmp.docx")
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for name, content in members.items():
            target.writestr(name, content)
    temporary.replace(file_path)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for template in manifest["templates"]:
        process(template)
    print(f"Normalized {len(manifest['templates'])} PCN DOCX templates")


if __name__ == "__main__":
    main()
