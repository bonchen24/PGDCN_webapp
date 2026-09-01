"""Repair mechanical defects found while rendering the checked-in PCN form pack.

The source survey showed that several extracted forms contained duplicated table
rows and duplicated scalar placeholders.  PCN currently creates one operational
record per sample lot / lab route, so each affected form keeps one summary row.
This preserves the approved table geometry without producing false duplicate
sample records in generated documents.
"""

from pathlib import Path

from docx import Document
from docx.oxml.ns import qn


ROOT = Path(__file__).resolve().parents[1] / "templates" / "pcn"


def remove_row(table, index: int) -> None:
    row = table.rows[index]
    row._tr.getparent().remove(row._tr)


def keep_rows(table, count: int) -> None:
    while len(table.rows) > count:
        remove_row(table, len(table.rows) - 1)


def remove_table(document, index: int) -> None:
    table = document.tables[index]
    table._element.getparent().remove(table._element)


def set_paragraph_text(paragraph, value: str) -> None:
    if not paragraph.runs:
        paragraph.add_run(value)
        return
    paragraph.runs[0].text = value
    for run in paragraph.runs[1:]:
        run.text = ""


def repair_evaluation_plan() -> None:
    path = ROOT / "PCN_Ke_hoach_danh_gia_CNSP.docx"
    document = Document(path)
    set_paragraph_text(document.paragraphs[6], "Phương thức đánh giá: [[method_label]]")
    set_paragraph_text(document.paragraphs[7], "Chuẩn mực đánh giá: [[tieu_chuan]]")
    document.save(path)


def repair_sample_coding() -> None:
    path = ROOT / "PCN_Bien_ban_ma_hoa_mau.docx"
    document = Document(path)
    while len(document.tables) > 1:
        remove_table(document, len(document.tables) - 1)
    keep_rows(document.tables[0], 2)
    # The extracted source pack also carried two orphaned signature blocks
    # after the duplicate tables. Keep the first signature block only.
    for paragraph in list(document.paragraphs[5:]):
        paragraph._element.getparent().remove(paragraph._element)
    document.save(path)


def repair_handover() -> None:
    path = ROOT / "PCN_Bien_ban_giao_nhan_mau.docx"
    document = Document(path)
    recipient_cell = document.tables[1].cell(2, 0)
    recipient_cell.text = "Bên nhận : [[phong_thu_nghiem]]\nMã phòng thử nghiệm : [[ma_phong_thu_nghiem]]"
    keep_rows(document.tables[2], 2)
    document.tables[3].cell(1, 0).text = "Người nhận [[nguoi_nhan]]\n"
    document.tables[3].cell(1, 1).text = "Người giao [[nguoi_giao]]\n"
    date_cell = document.tables[3].cell(0, 1)
    date_cell.text = date_cell.text.replace("2020", "")
    document.save(path)


def repair_lab_request() -> None:
    path = ROOT / "PCN_PYC_gui_PTN.docx"
    document = Document(path)
    keep_rows(document.tables[1], 2)
    document.save(path)


def repair_assignment_layout() -> None:
    path = ROOT / "PCN_Phan_cong_chung_nhan.docx"
    document = Document(path)
    replacements = {
        1: "Mã hồ sơ/Đề nghị: [[so_dang_ky]]",
        2: "Đơn vị yêu cầu: [[ten_cong_ty]]",
        3: "Địa điểm lấy mẫu: [[dia_chi_kho]]",
        4: "Ngày giờ thực hiện: [[ngay_lay_mau]]",
        5: "Người liên hệ: [[nguoi_lien_he]]    Điện thoại: [[dien_thoai]]",
        8: "     Trưởng đoàn: [[nguoi_danh_gia]]",
        9: "     Chuyên gia đánh giá/tập sự: [[nguoi_tham_xet]]",
        13: "1. Phương pháp/Tiêu chuẩn áp dụng: [[tieu_chuan]]",
    }
    for index, value in replacements.items():
        set_paragraph_text(document.paragraphs[index], value)
    row = document.tables[0].rows[2]
    for cell in row.cells:
        cell.text = ""
    tr_pr = row._tr.get_or_add_trPr()
    height = tr_pr.find(qn("w:trHeight"))
    if height is not None:
        height.set(qn("w:val"), "650")
    document.save(path)


def repair_field_inspection() -> None:
    path = ROOT / "PCN_Bien_ban_kiem_tra_hien_truong.docx"
    document = Document(path)
    replacements = {
        0: "Mã hồ sơ: [[so_dang_ky]]",
        4: "3. Đại diện doanh nghiệp/ khách hàng, chức vụ: [[nguoi_lien_he]]",
        8: "- Ông/ bà: [[nguoi_danh_gia]]    Chức danh: Trưởng đoàn",
        10: "- Ông/ bà: [[nguoi_tham_xet]]    Chức danh: Thành viên",
        14: "- Xuất xứ hoặc hãng/ nước sản xuất: [[nha_san_xuat]]",
        15: "7. Quy chuẩn kỹ thuật quốc gia: [[tieu_chuan]]",
        16: "Tiêu chuẩn sản phẩm: [[tieu_chuan]]",
        35: "b) Số mẫu đã lấy để thử nghiệm: [[so_luong_mau]]",
        36: "(Biên bản lấy mẫu số: [[ma_lo]], ngày [[ngay_lay_mau]])",
    }
    for index, value in replacements.items():
        set_paragraph_text(document.paragraphs[index], value)
    document.save(path)


def repair_sample_taking() -> None:
    path = ROOT / "PCN_Bien_ban_lay_mau.docx"
    document = Document(path)
    replacements = {
        4: "Nhãn hiệu thương mại: [[nhan_hieu]]",
        5: "Quy chuẩn: [[tieu_chuan]]",
        6: "Tổ chức sản xuất: [[nha_san_xuat]]",
        7: "Địa điểm lấy mẫu: [[dia_chi_kho]]",
        15: "Yêu cầu thử nghiệm (Tiêu chuẩn, Quy chuẩn, Thông tư, ...): [[tieu_chuan]]",
        16: "Mẫu được chuyển đến PTN trước ngày: [[ngay_giao_mau]]",
        17: "Thông tin khác: [[ghi_chu]]",
    }
    for index, value in replacements.items():
        set_paragraph_text(document.paragraphs[index], value)
    table = document.tables[0]
    table.cell(0, 2).text = "Ký hiệu mẻ/lô"
    table.cell(0, 4).text = "Tem niêm phong/Ký hiệu mã hóa"
    data_row = table.rows[1].cells
    data_row[0].text = "1"
    data_row[1].text = "[[loai_sp]] / [[model]]"
    data_row[2].text = "[[ma_lo]]"
    data_row[3].text = "[[so_luong_mau]]"
    data_row[4].text = "[[seal_stamp]] / [[ma_mau]]"
    for cell in document.tables[1].rows[0].cells:
        cell.text = cell.text.replace("[[ngay_lay_mau]] [[ngay_lay_mau]]", "[[ngay_lay_mau]]")
    document.tables[1].cell(1, 0).text = "Người lấy mẫu\n[[nguoi_danh_gia]]"
    document.tables[1].cell(1, 2).text = "Đại diện Tổ chức\n[[nguoi_lien_he]]"
    document.save(path)


if __name__ == "__main__":
    repair_evaluation_plan()
    repair_sample_coding()
    repair_handover()
    repair_lab_request()
    repair_assignment_layout()
    repair_field_inspection()
    repair_sample_taking()
    print("Repaired PCN DOCX templates in", ROOT)
