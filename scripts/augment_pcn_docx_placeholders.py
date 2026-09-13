"""Add missing runtime fields to the checked-in PCN DOCX templates.

The app owns the form contract and the DOCX pack owns the layout. This small,
idempotent maintenance script keeps the two contracts aligned by appending a
compact two-column section only when a template is missing a field. Existing
layout and existing placeholder runs are left untouched.
"""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / "templates" / "pcn"
PLACEHOLDER_RE = re.compile(r"\[\[([^\]]+)\]\]")


FIELDS: dict[str, list[tuple[str, str]]] = {
    "PCN_De_nghi_chung_nhan.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Người liên hệ", "nguoi_lien_he"),
        ("Điện thoại", "dien_thoai"),
        ("Email", "email"),
        ("Địa chỉ kho lấy mẫu", "dia_chi_kho"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Phan_cong_chung_nhan.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Ngày phân công", "ngay_phan_cong"),
        ("Người giao", "nguoi_giao"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Ke_hoach_danh_gia_CNSP.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Ngày kết thúc", "ngay_ket_thuc"),
        ("Địa điểm lập", "dia_diem_lap"),
        ("Người liên hệ", "nguoi_lien_he"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Bien_ban_kiem_tra_hien_truong.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Ngày kiểm tra", "ngay_kiem_tra"),
        ("Địa điểm lập", "dia_diem_lap"),
        ("Kết luận", "ket_luan"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Bien_ban_lay_mau.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Địa điểm lập", "dia_diem_lap"),
        ("Kết luận", "ket_luan"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Bien_ban_ma_hoa_mau.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Bien_ban_giao_nhan_mau.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Ghi chú", "ghi_chu"),
        ("Địa chỉ khách hàng", "dia_chi_ct"),
    ],
    "PCN_PYC_gui_PTN.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Phương thức chứng nhận", "method_label"),
        ("Địa chỉ kho lấy mẫu", "dia_chi_kho"),
    ],
    "PCN_Bao_cao_danh_gia_CNSP.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Địa chỉ khách hàng", "dia_chi_ct"),
        ("Người đánh giá", "nguoi_danh_gia"),
        ("Kết luận", "ket_luan"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Ket_qua_chung_nhan_phu_luc.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Địa chỉ khách hàng", "dia_chi_ct"),
        ("Ngày lập", "ngay_lap"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Ho_so_gui_khach_hang.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Tên sản phẩm", "loai_sp"),
        ("Địa chỉ khách hàng", "dia_chi_ct"),
    ],
    "PCN_Hop_dong_dich_vu_chung_nhan.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Số đăng ký", "so_dang_ky"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Giay_chung_nhan.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Ngày lập", "ngay_lap"),
        ("Người phê duyệt", "nguoi_phe_duyet"),
    ],
    "PCN_Quyet_dinh.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Phương thức chứng nhận", "method_label"),
        ("Ngày lập", "ngay_lap"),
        ("Người phê duyệt", "nguoi_phe_duyet"),
    ],
    "PCN_Bia_ho_so.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Phương thức chứng nhận", "method_label"),
        ("Địa chỉ khách hàng", "dia_chi_ct"),
        ("Ghi chú", "ghi_chu"),
    ],
    "PCN_Bao_cao_KQTN.docx": [
        ("Số hồ sơ", "ma_ho_so"),
        ("Lĩnh vực", "field_code"),
        ("Model", "model"),
        ("Mã mẫu", "ma_mau"),
        ("Ghi chú", "ghi_chu"),
        ("Người liên hệ", "nguoi_lien_he"),
    ],
}


def all_text(document: Document) -> str:
    chunks: list[str] = [paragraph.text for paragraph in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            chunks.extend(cell.text for cell in row.cells)
    return "\n".join(chunks)


def format_cell(cell, *, bold: bool = False) -> None:
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    for paragraph in cell.paragraphs:
        paragraph.paragraph_format.space_before = Pt(0)
        paragraph.paragraph_format.space_after = Pt(0)
        paragraph.paragraph_format.line_spacing = 1.0
        for run in paragraph.runs:
            run.font.size = Pt(9)
            run.bold = bold


def set_table_borders(table) -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), "D9D9D9")


def shade_cell(cell, fill: str) -> None:
    properties = cell._tc.get_or_add_tcPr()
    shading = properties.find(qn("w:shd"))
    if shading is None:
        shading = OxmlElement("w:shd")
        properties.append(shading)
    shading.set(qn("w:fill"), fill)


def set_repeat_header(row) -> None:
    properties = row._tr.get_or_add_trPr()
    if properties.find(qn("w:tblHeader")) is None:
        properties.append(OxmlElement("w:tblHeader"))


def normalize_supplemental_tables(document: Document) -> bool:
    changed = False
    for table in document.tables:
        if not table.rows or len(table.rows[0].cells) < 2:
            continue
        header = tuple(cell.text.strip() for cell in table.rows[0].cells[:2])
        if header == ("Trường", "Giá trị"):
            before = table.rows[0]._tr.get_or_add_trPr().find(qn("w:tblHeader"))
            set_repeat_header(table.rows[0])
            changed = changed or before is None
    return changed


def append_missing_fields(document: Document, missing: list[tuple[str, str]]) -> None:
    if "Heading 2" in document.styles:
        document.add_heading("Thông tin bổ sung", level=2)
    else:
        heading = document.add_paragraph()
        run = heading.add_run("Thông tin bổ sung")
        run.bold = True
        run.font.size = Pt(11)
    table = document.add_table(rows=1, cols=2)
    if "Table Grid" in document.styles:
        table.style = "Table Grid"
    set_table_borders(table)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    headers = ("Trường", "Giá trị")
    set_repeat_header(table.rows[0])
    for cell, value in zip(table.rows[0].cells, headers):
        cell.text = value
        shade_cell(cell, "D9EAF7")
        format_cell(cell, bold=True)
    for label, key in missing:
        row = table.add_row()
        row.cells[0].text = label
        row.cells[1].text = f"[[{key}]]"
        format_cell(row.cells[0])
        format_cell(row.cells[1])


def main() -> None:
    changed = 0
    for filename, fields in FIELDS.items():
        path = TEMPLATE_DIR / filename
        if not path.exists():
            raise FileNotFoundError(path)
        document = Document(path)
        existing = set(PLACEHOLDER_RE.findall(all_text(document)))
        missing = [(label, key) for label, key in fields if key not in existing]
        table_changed = normalize_supplemental_tables(document)
        if not missing and not table_changed:
            print(f"UNCHANGED {filename}")
            continue
        if missing:
            append_missing_fields(document, missing)
        document.save(path)
        changed += 1
        details = ', '.join(key for _, key in missing) or 'lặp hàng tiêu đề bảng'
        print(f"UPDATED {filename}: {details}".encode("ascii", "replace").decode())
    print(f"Changed {changed} template(s)")


if __name__ == "__main__":
    main()
