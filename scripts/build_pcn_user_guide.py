from pathlib import Path
from datetime import date

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "docs" / "user-guide-assets"
OUT = ROOT / "docs" / "PCN_Huong_dan_su_dung_phan_mem_theo_role.docx"

NAVY = "153A5B"
TEAL = "007C91"
SKY = "E8F4F7"
PALE_BLUE = "F3F7FA"
GOLD = "B78103"
RED = "A43A3A"
GRAY = "5B6770"
LIGHT_GRAY = "E4E9ED"
WHITE = "FFFFFF"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, **kwargs):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        if edge in kwargs:
            tag = "w:" + edge
            element = borders.find(qn(tag))
            if element is None:
                element = OxmlElement(tag)
                borders.append(element)
            for key in ["val", "sz", "space", "color"]:
                if key in kwargs[edge]:
                    element.set(qn("w:" + key), str(kwargs[edge][key]))


def set_cell_margins(cell, top=100, start=130, bottom=100, end=130):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_table_width(table, widths):
    for row in table.rows:
        for idx, width in enumerate(widths):
            if idx < len(row.cells):
                row.cells[idx].width = Cm(width)


def set_paragraph_border(paragraph, color=TEAL, size="12", space="4"):
    p = paragraph._p
    p_pr = p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    bottom = p_bdr.find(qn("w:bottom"))
    if bottom is None:
        bottom = OxmlElement("w:bottom")
        p_bdr.append(bottom)
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), size)
    bottom.set(qn("w:space"), space)
    bottom.set(qn("w:color"), color)


def add_page_field(paragraph):
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def add_bookmark(paragraph, name):
    start = OxmlElement("w:bookmarkStart")
    start.set(qn("w:id"), str(abs(hash(name)) % 100000))
    start.set(qn("w:name"), name)
    end = OxmlElement("w:bookmarkEnd")
    end.set(qn("w:id"), start.get(qn("w:id")))
    paragraph._p.insert(0, start)
    paragraph._p.append(end)


def add_alt_text(inline_shape, description):
    doc_pr = inline_shape._inline.docPr
    doc_pr.set("descr", description)
    doc_pr.set("title", description)


def configure_document(doc):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.55)
    section.bottom_margin = Cm(1.45)
    section.left_margin = Cm(1.75)
    section.right_margin = Cm(1.75)
    section.header_distance = Cm(0.7)
    section.footer_distance = Cm(0.7)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Arial"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    normal.font.size = Pt(9.8)
    normal.font.color.rgb = RGBColor.from_string("263238")
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.12

    for style_name, size, color, before, after in [
        ("Title", 30, NAVY, 0, 12),
        ("Heading 1", 19, NAVY, 14, 7),
        ("Heading 2", 14, TEAL, 10, 5),
        ("Heading 3", 11, NAVY, 7, 3),
    ]:
        st = styles[style_name]
        st.font.name = "Arial"
        st._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = RGBColor.from_string(color)
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True

    if "Caption" not in styles:
        caption = styles.add_style("Caption", WD_STYLE_TYPE.PARAGRAPH)
    else:
        caption = styles["Caption"]
    caption.font.name = "Arial"
    caption._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    caption.font.size = Pt(8.5)
    caption.font.italic = True
    caption.font.color.rgb = RGBColor.from_string(GRAY)
    caption.paragraph_format.space_before = Pt(3)
    caption.paragraph_format.space_after = Pt(7)
    caption.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if "Callout" not in styles:
        callout = styles.add_style("Callout", WD_STYLE_TYPE.PARAGRAPH)
    else:
        callout = styles["Callout"]
    callout.base_style = styles["Normal"]
    callout.font.name = "Arial"
    callout._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    callout.font.size = Pt(9.3)
    callout.paragraph_format.left_indent = Cm(0.28)
    callout.paragraph_format.right_indent = Cm(0.2)
    callout.paragraph_format.space_before = Pt(4)
    callout.paragraph_format.space_after = Pt(7)

    if "Small" not in styles:
        small = styles.add_style("Small", WD_STYLE_TYPE.PARAGRAPH)
    else:
        small = styles["Small"]
    small.base_style = styles["Normal"]
    small.font.name = "Arial"
    small._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    small.font.size = Pt(8.5)
    small.font.color.rgb = RGBColor.from_string(GRAY)

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    header_run = header.add_run("PGDCN  |  HƯỚNG DẪN SỬ DỤNG")
    header_run.font.name = "Arial"
    header_run.font.size = Pt(8)
    header_run.font.bold = True
    header_run.font.color.rgb = RGBColor.from_string(GRAY)
    set_paragraph_border(header, color=LIGHT_GRAY, size="6", space="3")

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = footer.add_run("Tài liệu nội bộ  •  Phiên bản biên soạn 07/09/2026  •  Trang ")
    fr.font.name = "Arial"
    fr.font.size = Pt(8)
    fr.font.color.rgb = RGBColor.from_string(GRAY)
    add_page_field(footer)

    doc.core_properties.title = "Hướng dẫn sử dụng phần mềm PGDCN theo vai trò"
    doc.core_properties.subject = "Hướng dẫn PCN và PGD"
    doc.core_properties.author = "TVCI"
    doc.core_properties.keywords = "PGDCN, PCN, PGD, hướng dẫn sử dụng, RBAC"


def add_run_text(paragraph, text, bold=False, color=None, size=None, italic=False):
    run = paragraph.add_run(text)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if size:
        run.font.size = Pt(size)
    run.font.name = "Arial"
    return run


def add_paragraph(doc, text="", style=None, align=None, space_after=None):
    p = doc.add_paragraph(style=style)
    if text:
        add_run_text(p, text)
    if align is not None:
        p.alignment = align
    if space_after is not None:
        p.paragraph_format.space_after = Pt(space_after)
    return p


def add_callout(doc, label, text, fill=SKY, label_color=TEAL):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    tr_pr = table.rows[0]._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    set_cell_margins(cell, top=125, start=170, bottom=125, end=170)
    set_cell_border(cell, top={"val": "single", "sz": 6, "color": LIGHT_GRAY},
                    bottom={"val": "single", "sz": 6, "color": LIGHT_GRAY},
                    left={"val": "single", "sz": 18, "color": label_color},
                    right={"val": "single", "sz": 6, "color": LIGHT_GRAY})
    p = cell.paragraphs[0]
    p.style = doc.styles["Callout"]
    add_run_text(p, label + "  ", bold=True, color=label_color)
    add_run_text(p, text)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_steps(doc, steps):
    for idx, step in enumerate(steps, 1):
        p = doc.add_paragraph(style="Normal")
        p.paragraph_format.left_indent = Cm(0.48)
        p.paragraph_format.first_line_indent = Cm(-0.38)
        add_run_text(p, f"{idx}. ", bold=False, color=NAVY)
        add_run_text(p, step)


def add_bullets(doc, bullets):
    for bullet in bullets:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Cm(0.45)
        add_run_text(p, bullet)


def add_screenshot(doc, filename, caption, width_cm=16.3):
    path = ASSET_DIR / filename
    if not path.exists():
        add_callout(doc, "Thiếu ảnh", f"Không tìm thấy ảnh minh họa {filename}.", fill="FFF5E5", label_color=GOLD)
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(0)
    shape = p.add_run().add_picture(str(path), width=Cm(width_cm))
    add_alt_text(shape, caption)
    cp = doc.add_paragraph(style="Caption")
    cp.add_run(caption)


def add_section_heading(doc, text, level=1, anchor=None):
    p = doc.add_paragraph(style=f"Heading {level}")
    p.add_run(text)
    if anchor:
        add_bookmark(p, anchor)
    return p


def add_table(doc, headers, rows, widths=None, font_size=8.4):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    hdr = table.rows[0]
    set_repeat_table_header(hdr)
    for idx, header in enumerate(headers):
        cell = hdr.cells[idx]
        set_cell_shading(cell, NAVY)
        set_cell_margins(cell, top=105, start=110, bottom=105, end=110)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(header)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(font_size)
        r.font.color.rgb = RGBColor.from_string(WHITE)
    for row_idx, row_data in enumerate(rows):
        row = table.add_row()
        fill = WHITE if row_idx % 2 == 0 else PALE_BLUE
        for idx, value in enumerate(row_data):
            cell = row.cells[idx]
            set_cell_shading(cell, fill)
            set_cell_margins(cell, top=95, start=110, bottom=95, end=110)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            p = cell.paragraphs[0]
            r = p.add_run(str(value))
            r.font.name = "Arial"
            r.font.size = Pt(font_size)
            r.font.color.rgb = RGBColor.from_string("263238")
    if widths:
        set_table_width(table, widths)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def add_role_card(doc, role, purpose, actions, note=None):
    add_section_heading(doc, role, 2)
    p = add_paragraph(doc)
    add_run_text(p, "Mục tiêu: ", bold=True, color=NAVY)
    add_run_text(p, purpose)
    add_bullets(doc, actions)
    if note:
        add_callout(doc, "Lưu ý quyền", note, fill="FFF8E8", label_color=GOLD)


def feature(doc, title, purpose, steps, screenshot=None, caption=None, note=None):
    add_section_heading(doc, title, 2)
    p = add_paragraph(doc)
    add_run_text(p, "Mục đích: ", bold=True, color=TEAL)
    add_run_text(p, purpose)
    add_paragraph(doc, "Các bước thực hiện", style="Heading 3")
    add_steps(doc, steps)
    if screenshot:
        add_screenshot(doc, screenshot, caption or screenshot)
    if note:
        add_callout(doc, "Lưu ý", note)


def add_cover(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(26)
    p.paragraph_format.space_after = Pt(0)
    add_run_text(p, "IEMM • TVCI", bold=True, color=TEAL, size=15)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    band = doc.add_table(rows=1, cols=1)
    band.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = band.cell(0, 0)
    set_cell_shading(cell, NAVY)
    set_cell_margins(cell, top=230, start=220, bottom=230, end=220)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run_text(p, "HƯỚNG DẪN SỬ DỤNG\nPHẦN MỀM PGDCN", bold=True, color=WHITE, size=26)
    p.paragraph_format.line_spacing = 1.05

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    add_run_text(p, "PCN • Chứng nhận  |  PGD • Giám định", bold=True, color=NAVY, size=15)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run_text(p, "Hướng dẫn theo tính năng và vai trò người dùng", color=GRAY, size=11)

    add_callout(doc, "Phạm vi", "Tài liệu mô tả thao tác trên giao diện PGDCN hiện hành, bao gồm đăng nhập, điều hướng, nghiệp vụ PCN, nghiệp vụ PGD, quản trị, AI, nhật ký và các bước kiểm soát hồ sơ.")
    add_callout(doc, "Phiên bản", "Biên soạn ngày 07/09/2026. Giao diện minh họa được chụp từ môi trường chạy thật tại thời điểm biên soạn.", fill="F7F3E8", label_color=GOLD)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(56)
    add_run_text(p, "TÀI LIỆU NỘI BỘ", bold=True, color=GRAY, size=10)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run_text(p, "Không ghi thông tin mật khẩu trong tài liệu.", italic=True, color=GRAY, size=9)
    doc.add_page_break()


def add_contents(doc):
    add_section_heading(doc, "Mục lục và cách sử dụng tài liệu", 1, "muc-luc")
    add_paragraph(doc, "Tài liệu được tổ chức theo hai lớp: từng tính năng và từng vai trò. Người dùng có thể đọc chương 1–3 để làm quen, sau đó đi thẳng tới phần vai trò của mình.")
    rows = [
        ("1", "Bắt đầu sử dụng", "Tất cả vai trò"),
        ("2", "Vai trò, quyền và nguyên tắc thao tác", "Tất cả vai trò"),
        ("3", "Không gian chung: dashboard, thông báo, khách hàng, cá nhân", "Tất cả vai trò"),
        ("4", "Nghiệp vụ PCN: Đề nghị, hồ sơ, mẫu, PYC, KQTN, tài liệu", "Nhân viên PCN, lãnh đạo, admin"),
        ("5", "Nghiệp vụ PGD: tiếp nhận PYC, sổ đăng ký và hồ sơ", "Nhân viên PGD, lãnh đạo, admin"),
        ("6", "Quản trị hệ thống: hồ sơ mẫu, nhân sự, cấu hình", "Admin, lãnh đạo được ủy quyền"),
        ("7", "Trợ lý AI và nhật ký hoạt động", "Tất cả vai trò theo quyền"),
        ("8", "Quy trình nhanh theo từng vai trò", "Từng nhóm người dùng"),
        ("9", "Xử lý lỗi và kiểm soát dữ liệu", "Tất cả vai trò"),
    ]
    add_table(doc, ["Mục", "Nội dung", "Đối tượng chính"], rows, widths=[1.1, 10.9, 5.2], font_size=8.7)
    add_callout(doc, "Quy ước", "Tên nút, tên menu và tên trạng thái trong tài liệu được giữ theo giao diện. Một số nút có thể không xuất hiện nếu tài khoản không có quyền hoặc hồ sơ không thuộc phạm vi được phân công.")


def add_intro(doc):
    add_section_heading(doc, "1. Bắt đầu sử dụng", 1, "bat-dau")
    add_paragraph(doc, "PGDCN là không gian nghiệp vụ chung cho hai miền: PCN (Chứng nhận) và PGD (Giám định). Cùng một phiên đăng nhập, người dùng chuyển đổi giữa hai miền từ thanh điều hướng bên trái.")
    feature(
        doc,
        "1.1. Đăng nhập",
        "Tạo phiên làm việc để hệ thống tải đúng menu, lĩnh vực và quyền của tài khoản.",
        [
            "Mở địa chỉ PGDCN được đơn vị cung cấp.",
            "Nhập tên tài khoản vào ô Tên đăng nhập.",
            "Nhập mật khẩu vào ô Mật khẩu rồi chọn Đăng nhập.",
            "Chờ hệ thống xác thực phiên. Khi thành công, kiểm tra tên người dùng ở góc trên bên trái và menu chức năng được hiển thị.",
            "Nếu không vào được, kiểm tra lại thông tin đăng nhập, kết nối mạng và thông báo lỗi ngay dưới biểu mẫu.",
        ],
        "02-login.png",
        "Hình 1. Màn hình đăng nhập PGDCN.",
        "Không chia sẻ mật khẩu trong tài liệu, ảnh chụp màn hình, nhóm chat hoặc nhật ký thao tác. Khi dùng máy chung, luôn đăng xuất sau khi hoàn tất.",
    )
    feature(
        doc,
        "1.2. Nhận biết phiên làm việc",
        "Đảm bảo người dùng đang thao tác đúng tài khoản và đúng phạm vi nghiệp vụ.",
        [
            "Quan sát tên hiển thị và mã tài khoản ở khu vực người dùng.",
            "Kiểm tra nhóm menu CHỨNG NHẬN (PCN) và GIÁM ĐỊNH (PGD).",
            "Nếu menu hoặc dữ liệu không đúng phạm vi, dừng thao tác và liên hệ quản trị thay vì tự tạo bản ghi ngoài phạm vi.",
        ],
        "04-sidebar-pcn.png",
        "Hình 2. Thanh điều hướng với nhóm chức năng PCN được mở.",
    )


def add_roles(doc):
    add_section_heading(doc, "2. Vai trò, quyền và nguyên tắc thao tác", 1, "vai-tro")
    add_paragraph(doc, "Quyền truy cập được xác định bởi role hệ thống, chức vụ nghiệp vụ, lĩnh vực được phân công và phạm vi hồ sơ. Chức vụ không tự động tạo quyền nếu tài khoản chưa được gán đúng scope.")
    rows = [
        ("Admin hệ thống", "Quản trị toàn bộ PCN/PGD và cấu hình", "Nhân sự, role, hồ sơ mẫu, cấu hình, backup/restore, toàn bộ nghiệp vụ"),
        ("Lãnh đạo / Leadership", "Điều hành, xem xét và phê duyệt", "Giao việc, xem xét kỹ thuật, phê duyệt, phát hành, trả kết quả, lưu trữ trong scope"),
        ("Certification Expert", "Chuyên viên chứng nhận PCN", "Tiếp nhận Đề nghị, chuẩn bị hồ sơ, xử lý QC4/QC9, phối hợp mẫu/PYC/KQTN"),
        ("Technical Reviewer", "Chuyên gia soát xét kỹ thuật", "Kiểm tra tính đầy đủ, kết quả thử nghiệm, checklist và kết luận kỹ thuật"),
        ("Sample Coordinator", "Điều phối mẫu", "Sổ mẫu, đóng gói/tuyến phòng thử, PYC, tiếp nhận/trạng thái tuyến PTN"),
        ("Document Clerk", "Thư ký hồ sơ/tài liệu", "Soạn thảo DOCX/PDF, tài liệu yêu cầu, phát hành, giao trả và lưu trữ"),
        ("Staff / Unassigned", "Nhân viên nghiệp vụ theo scope", "Chỉ thao tác các nghiệp vụ được gán; Unassigned không thay thế quyền nghiệp vụ"),
        ("Viewer", "Tra cứu", "Chỉ xem dữ liệu trong scope; không tạo, sửa, xóa, chuyển trạng thái hay phê duyệt"),
    ]
    add_table(doc, ["Vai trò", "Mục tiêu", "Nhóm quyền chính"], rows, widths=[3.1, 5.1, 9.0], font_size=8.15)
    add_callout(doc, "Nguyên tắc", "Máy chủ kiểm tra RBAC ở từng thao tác. Việc nhìn thấy menu không có nghĩa là được phép thay đổi mọi hồ sơ; hệ thống có thể từ chối khi bản ghi nằm ngoài scope hoặc chưa đến bước workflow.", fill="FFF8E8", label_color=GOLD)

    add_role_card(doc, "2.1. Admin hệ thống", "Duy trì cấu hình và vận hành toàn bộ phòng.", [
        "Kiểm tra nhân sự, role, chức vụ và lĩnh vực được phân công.",
        "Quản lý hồ sơ mẫu, revision workflow, tài liệu yêu cầu và cấu hình PCN/PGD.",
        "Theo dõi nhật ký, backup/restore và kiểm tra dữ liệu bất thường.",
    ], "Chỉ cấp quyền quản trị cho người được ủy quyền; thay đổi workflow có thể ảnh hưởng hồ sơ đang chạy.")
    add_role_card(doc, "2.2. Lãnh đạo / người phê duyệt", "Điều phối và ra quyết định tại các node được phân công.", [
        "Theo dõi dashboard và sổ tổng hợp để nhận biết hồ sơ trễ hoặc thiếu.",
        "Giao việc, xem xét kỹ thuật, phê duyệt, ký/phát hành, trả kết quả và lưu trữ.",
        "Kiểm tra nhật ký khi cần truy nguyên người thực hiện và thời điểm chuyển trạng thái.",
    ], "Quyền quản lý người dùng chỉ áp dụng khi tài khoản được gán vai trò quản lý và đúng phạm vi.")
    add_role_card(doc, "2.3. Nhân viên nghiệp vụ", "Hoàn thành các task được gán trong PCN hoặc PGD.", [
        "Làm việc từ Đề nghị/hồ sơ được tạo hoặc được giao.",
        "Cập nhật thông tin theo node; không sửa trực tiếp các trường đã snapshot trên sổ đăng ký.",
        "Đính kèm tài liệu, tạo PYC, theo dõi kết quả thử nghiệm và chuyển node đúng quy trình.",
    ])
    add_role_card(doc, "2.4. Viewer", "Tra cứu và giám sát mà không làm thay đổi dữ liệu.", [
        "Dùng dashboard, sổ tổng hợp, hồ sơ chi tiết, nhật ký và thông báo để xem.",
        "Không sử dụng các nút tạo mới, lưu, gửi, đổi trạng thái, phê duyệt hoặc phát hành.",
        "Nếu cần điều chỉnh dữ liệu, gửi yêu cầu cho người có quyền và ghi rõ mã hồ sơ.",
    ], "Nếu giao diện vẫn hiển thị nút do cache, máy chủ vẫn là nơi quyết định cuối cùng và có thể trả lỗi 403/không đủ quyền.")


def add_common(doc):
    add_section_heading(doc, "3. Không gian chung", 1, "khong-gian-chung")
    feature(
        doc,
        "3.1. Dashboard – Tổng quan phòng",
        "Xem nhanh số lượng hồ sơ, công việc, mẫu, cảnh báo và hoạt động mới của hai miền.",
        [
            "Chọn Tổng quan phòng ở thanh menu.",
            "Đọc các thẻ KPI và khu vực cảnh báo để xác định việc cần xử lý trước.",
            "Chọn một thẻ hoặc liên kết chi tiết để đi tới sổ/hồ sơ tương ứng.",
            "Sau khi xử lý một hồ sơ, quay lại dashboard và làm mới để kiểm tra số liệu.",
        ],
        "01-dashboard.png",
        "Hình 3. Dashboard tổng quan phòng sau khi đăng nhập.",
    )
    feature(
        doc,
        "3.2. Thông báo phòng",
        "Theo dõi các sự kiện mới, đặc biệt là thay đổi trạng thái mẫu/PYC, hồ sơ và việc được giao.",
        [
            "Chọn biểu tượng chuông ở vùng đầu trang.",
            "Đọc miền nghiệp vụ, thời gian, nội dung và trạng thái đã đọc/chưa đọc.",
            "Chọn thông báo liên quan để mở hồ sơ hoặc khu vực xử lý.",
            "Sau khi xử lý, mở lại danh sách để xác nhận trạng thái thông báo đã cập nhật.",
        ],
        "03-notifications.png",
        "Hình 4. Danh sách thông báo phòng của PCN và PGD.",
    )
    feature(
        doc,
        "3.3. Khách hàng",
        "Tra cứu và bổ sung dữ liệu khách hàng dùng chung cho PCN/PGD.",
        [
            "Chọn Khách hàng.",
            "Nhập tên, mã hoặc thông tin liên hệ vào ô tìm kiếm; dùng bộ lọc nếu có.",
            "Để thêm khách hàng, chọn nút tạo mới/thêm dòng, nhập tên pháp lý, mã số, địa chỉ và đầu mối liên hệ.",
            "Kiểm tra trùng dữ liệu rồi chọn Lưu. Chọn Hủy nếu chưa đủ thông tin hoặc không muốn tạo bản ghi.",
        ],
        "11-department-customers.png",
        "Hình 5. Danh sách khách hàng.",
        "Không tạo nhiều bản ghi cho cùng một khách hàng. Ưu tiên tìm kiếm trước khi thêm mới.",
    )
    add_screenshot(doc, "12-customer-form.png", "Hình 6. Biểu mẫu thêm khách hàng inline; chỉ lưu khi đã kiểm tra đủ thông tin.")
    feature(
        doc,
        "3.4. Thiết lập cá nhân",
        "Xem thông tin phiên, cấu hình trợ lý AI và tùy chọn hiển thị trên thiết bị.",
        [
            "Chọn nút tên người dùng ở khu vực đầu trang, sau đó chọn Mở thiết lập cá nhân.",
            "Kiểm tra tên, tài khoản, role hệ thống, chức vụ và lĩnh vực được phân công.",
            "Nếu được cấp quyền, nhập Gemini API Key cá nhân và chọn model; chọn Kiểm tra Google để xác thực.",
            "Chọn Lưu thiết lập AI. Các tùy chọn hiển thị chỉ ảnh hưởng trải nghiệm trên thiết bị hiện tại.",
            "Đóng bảng thiết lập khi hoàn tất.",
        ],
        "17-personal-settings.png",
        "Hình 7. Bảng thiết lập cá nhân.",
        "Không ghi API key hoặc thông tin bí mật vào tài liệu, ảnh chụp hoặc tin nhắn. Key được mô tả là lưu ở máy chủ theo cơ chế mã hóa.",
    )


def add_pcn(doc):
    add_section_heading(doc, "4. Nghiệp vụ PCN – Chứng nhận", 1, "pcn")
    add_paragraph(doc, "PCN bắt đầu từ Đề nghị, sau đó tạo hồ sơ chứng nhận, lập mẫu/PYC, nhận KQTN, soạn tài liệu và đi qua các bước xem xét – phê duyệt – phát hành – lưu trữ. QC4 và QC9 là hai trường lĩnh vực đang được thể hiện trên giao diện PCN.")
    feature(
        doc,
        "4.1. Đề nghị PCN – tra cứu và lọc",
        "Tiếp nhận, kiểm tra và mở các đề nghị làm nguồn cho hồ sơ chứng nhận.",
        [
            "Mở nhóm CHỨNG NHẬN (PCN), chọn Đề nghị.",
            "Dùng tìm kiếm để lọc theo mã, khách hàng, sản phẩm hoặc nội dung liên quan.",
            "Dùng bộ lọc trạng thái/kênh tiếp nhận nếu cần thu hẹp danh sách.",
            "Chọn một dòng để mở chi tiết; kiểm tra đủ thông tin trước khi tạo hoặc mở hồ sơ chuẩn.",
        ],
        "05-pcn-proposals.png",
        "Hình 8. Danh sách Đề nghị PCN.",
    )
    feature(
        doc,
        "4.2. Tạo Đề nghị PCN",
        "Ghi nhận nhu cầu chứng nhận và chuẩn bị dữ liệu đầu vào cho hồ sơ.",
        [
            "Từ Đề nghị, chọn Tạo Đề nghị/Tạo mới.",
            "Chọn kênh tiếp nhận, khách hàng và kiểm tra địa chỉ/đầu mối liên hệ.",
            "Nhập sản phẩm, model, thương hiệu, nhà sản xuất và các thông số nhận diện.",
            "Chọn lĩnh vực QC4 hoặc QC9 theo hồ sơ; không đánh dấu thay cho bước phân công kỹ thuật nếu chưa có căn cứ.",
            "Nếu có tài liệu nguồn, dùng khu vực tải/OCR để đưa chứng từ vào hồ sơ.",
            "Kiểm tra lại dữ liệu, chọn Tạo Đề nghị. Sau đó mở hồ sơ được tạo để tiếp tục workflow.",
        ],
        "06-pcn-create-proposal.png",
        "Hình 9. Biểu mẫu tạo Đề nghị PCN.",
        "Các trường định danh sản phẩm và khách hàng ảnh hưởng tới hồ sơ, mẫu và tài liệu sinh sau này; hãy kiểm tra chính tả và mã trước khi lưu.",
    )
    feature(
        doc,
        "4.3. Hồ sơ chứng nhận – tổng quan và workflow",
        "Theo dõi một bộ hồ sơ từ tiếp nhận đến phê duyệt, phát hành và lưu trữ.",
        [
            "Từ Đề nghị hoặc sổ tổng hợp, chọn Mở hồ sơ chuẩn/đường dẫn hồ sơ.",
            "Đọc tab Tổng quan để kiểm tra metadata, người phụ trách, lĩnh vực và trạng thái hiện tại.",
            "Mở tab Tài liệu hồ sơ để xem checklist và tài liệu còn thiếu theo node.",
            "Mở tab Mẫu & PYC để theo dõi lô mẫu và các yêu cầu gửi phòng thử.",
            "Mở tab KQTN để kiểm tra kết quả trả về; chỉ tiếp nhận/xác nhận khi dữ liệu đúng hồ sơ.",
            "Mở tab Phê duyệt để xem bước xem xét, người xử lý và hành động tiếp theo được phép.",
            "Chuyển node bằng nút trạng thái tương ứng sau khi hoàn thành đủ điều kiện; mọi thay đổi phải để lại dấu vết trong nhật ký.",
        ],
        "19-pcn-dossier-detail.png",
        "Hình 10. Chi tiết hồ sơ PCN: tài liệu, checklist, task và trạng thái workflow.",
        "Không bỏ qua tài liệu bắt buộc hoặc chuyển trạng thái khi task chưa hoàn thành. Nếu nút hành động không xuất hiện, kiểm tra scope và người được giao.",
    )
    feature(
        doc,
        "4.4. Sổ tổng hợp PCN",
        "Theo dõi toàn bộ hồ sơ theo mức độ đầy đủ, người phụ trách, lĩnh vực, trạng thái và năm.",
        [
            "Mở CHỨNG NHẬN (PCN) → Sổ tổng hợp.",
            "Chọn bộ lọc theo completeness, assignment, field, status hoặc year.",
            "Đọc các cột định danh, khách hàng, lĩnh vực, phụ trách, trạng thái và mốc thời gian.",
            "Mở dòng để vào hồ sơ; dùng Xuất CSV khi cần lập danh sách phục vụ điều phối.",
            "Sau khi giao việc hoặc cập nhật hồ sơ, tải lại sổ để số liệu phản ánh trạng thái mới.",
        ],
        "07-pcn-operations.png",
        "Hình 11. Sổ tổng hợp PCN với bộ lọc vận hành.",
    )
    feature(
        doc,
        "4.5. Sổ quản lý mẫu PCN",
        "Điều phối mẫu và các tuyến thử nghiệm theo hồ sơ.",
        [
            "Mở CHỨNG NHẬN (PCN) → Sổ quản lý mẫu.",
            "Lọc theo trạng thái lô mẫu, phòng thử, tuyến hoặc hồ sơ liên quan.",
            "Kiểm tra mã lô, số mẫu, phòng thử, trạng thái nhận/lịch/đang thử/hoàn tất.",
            "Nếu tuyến gặp lỗi tích hợp, dùng Retry PTN khi đã xác định nguyên nhân và được phép thao tác.",
            "Mở hồ sơ từ dòng mẫu để kiểm tra liên kết PYC, KQTN và tài liệu.",
        ],
        "08-pcn-sample-ledger.png",
        "Hình 12. Sổ quản lý mẫu PCN và trạng thái các tuyến phòng thử.",
        "Không tạo lô mẫu trùng cho cùng một hồ sơ. Luôn kiểm tra mã hồ sơ, phòng thử và trạng thái hiện tại trước khi retry.",
    )
    feature(
        doc,
        "4.6. Tạo PYC gửi phòng thử nghiệm",
        "Tạo PYC tổng và phát sinh PYC con theo từng phòng thử/tuyến thử.",
        [
            "Từ sổ mẫu hoặc hồ sơ PCN, chọn tạo PYC.",
            "Nhập số PYC, khách hàng, nguồn mẫu và kiểm tra hồ sơ liên kết.",
            "Chọn thêm PYC/batch để khai báo các tuyến phòng thử cần thực hiện.",
            "Kiểm tra danh sách PYC con, trường thử, số lượng và phòng thử nhận.",
            "Chọn Lưu để tạo bản ghi. Chọn Gửi chỉ khi dữ liệu đã kiểm tra và hồ sơ đủ điều kiện.",
            "Theo dõi ACK/RECEIVED/SCHEDULED/IN_PROGRESS/TEST_COMPLETED từ sổ mẫu hoặc nhật ký.",
        ],
        "09-pcn-create-pyc.png",
        "Hình 13. Biểu mẫu tạo PYC tổng và các PYC con.",
        "Gửi PYC có thể tạo sự kiện tích hợp sang ứng dụng phòng thử; không bấm Gửi nhiều lần khi chưa có phản hồi.",
    )
    feature(
        doc,
        "4.7. Theo dõi KQTN trả về",
        "Đối chiếu kết quả thử nghiệm với PYC và hồ sơ trước khi đưa vào xem xét kỹ thuật.",
        [
            "Mở hồ sơ PCN → tab KQTN hoặc mở tuyến tương ứng từ sổ mẫu.",
            "Đối chiếu mã PYC, phòng thử, mẫu, phiên bản và trạng thái trả kết quả.",
            "Mở file kết quả và kiểm tra nội dung, chữ ký/metadata theo quy định.",
            "Nếu kết quả thiếu hoặc sai liên kết, không phê duyệt; ghi nhận vấn đề và chuyển lại cho người phụ trách.",
            "Khi đủ kết quả, cập nhật checklist/tài liệu và chuyển hồ sơ sang bước xem xét kỹ thuật.",
        ],
        "19-pcn-dossier-detail.png",
        "Hình 14. Khu vực hồ sơ dùng để theo dõi tài liệu và kết quả thử nghiệm.",
    )
    feature(
        doc,
        "4.8. Soạn thảo tài liệu PCN",
        "Tạo bản soạn thảo DOCX/PDF từ metadata và template được cấu hình.",
        [
            "Mở CHỨNG NHẬN (PCN) → Soạn thảo tài liệu.",
            "Chọn loại tài liệu và hồ sơ nguồn.",
            "Kiểm tra metadata: khách hàng, sản phẩm, lĩnh vực, mã hồ sơ và người ký.",
            "Chọn Lưu bản nháp để lưu nội dung đang làm.",
            "Chọn Tạo DOCX + PDF khi thông tin đã đúng; mở file sinh ra để kiểm tra trước khi phát hành.",
            "Đính kèm bản cuối vào hồ sơ và chuyển node theo quyền được cấp.",
        ],
        "10-pcn-document-drafting.png",
        "Hình 15. Soạn thảo tài liệu PCN và sinh DOCX/PDF.",
        "Template chỉ tạo khung; người dùng vẫn phải kiểm tra nội dung, mã hồ sơ, người ký, số liệu và phụ lục trước khi phát hành.",
    )


def add_pgd(doc):
    add_section_heading(doc, "5. Nghiệp vụ PGD – Giám định", 1, "pgd")
    add_paragraph(doc, "PGD quản lý hồ sơ giám định phát sinh từ PYC. Màn hình sổ đăng ký cho phép tìm kiếm, lọc nhóm sản phẩm/trạng thái và mở từng hồ sơ để lập biên bản, đóng gói kết quả theo quy trình.")
    feature(
        doc,
        "5.1. Mở sổ đăng ký hồ sơ PGD",
        "Tra cứu các hồ sơ giám định đã được snapshot từ PYC.",
        [
            "Mở nhóm GIÁM ĐỊNH (PGD) → Hồ sơ PYC.",
            "Đọc số đăng ký/PYC, ngày, khách hàng, hàng hóa/lô, số lượng, địa điểm và người phụ trách.",
            "Lọc theo nhóm sản phẩm: Thép/kim loại, Máy/dây chuyền, Than hoặc Hàng hóa khác.",
            "Lọc theo trạng thái từ Bản nháp đến Đã lưu trữ.",
            "Chọn mã GD/PYC để mở hồ sơ chi tiết; chọn Tải lại sổ đăng ký PGD sau khi có cập nhật.",
        ],
        "18-pgd-workspace.png",
        "Hình 16. Sổ đăng ký hồ sơ PGD.",
        "Các trường đăng ký được snapshot từ PYC mới; không sửa trực tiếp trên bảng sổ đăng ký. Hãy mở hồ sơ để thực hiện bước được phép.",
    )
    add_section_heading(doc, "5.2. Chu trình PGD theo trạng thái", 2)
    rows = [
        ("Bản nháp", "Kiểm tra thông tin PYC, hàng hóa/lô, địa điểm và scope."),
        ("Xem xét năng lực", "Đánh giá khả năng thực hiện và điều kiện tiếp nhận."),
        ("Đã chấp nhận thực hiện", "Chốt việc nhận hồ sơ và chuẩn bị phân công."),
        ("Chuẩn bị giám định", "Chuẩn bị nhân sự, dụng cụ, tài liệu và lịch."),
        ("Giám định hiện trường", "Thực hiện hiện trường, lập biên bản và thu thập mẫu."),
        ("Chờ kết quả PTN", "Theo dõi yêu cầu thử nghiệm/kết quả phòng thử."),
        ("Xem xét kết quả", "Đối chiếu kết quả với hồ sơ và tiêu chí."),
        ("Soát xét kỹ thuật", "Người có vai trò kỹ thuật kiểm tra kết luận."),
        ("Phê duyệt lãnh đạo", "Lãnh đạo xem xét và phê duyệt."),
        ("Đã ký", "Tài liệu/chứng thư đã ký theo quy định."),
        ("Đã trả kết quả", "Hoàn tất giao trả cho khách hàng/đầu mối."),
        ("Đã lưu trữ", "Đóng hồ sơ và lưu theo chính sách."),
    ]
    add_table(doc, ["Trạng thái", "Việc cần kiểm tra"], rows, widths=[5.1, 12.9], font_size=8.5)
    feature(
        doc,
        "5.3. Tạo PYC PGD",
        "Tiếp nhận yêu cầu giám định mới và tạo số đăng ký/hồ sơ.",
        [
            "Từ Hồ sơ PYC, chọn Tạo PYC.",
            "Nhập khách hàng, loại hàng hóa/lô, số lượng/khối lượng, địa điểm và phương thức giám định.",
            "Bổ sung hợp đồng, vận đơn/C/O và đầu mối liên hệ nếu có.",
            "Kiểm tra dữ liệu trước khi lưu; hệ thống tạo số đăng ký PGD và đưa hồ sơ vào trạng thái phù hợp.",
            "Mở dòng hồ sơ vừa tạo để phân công, lập lịch hoặc tiếp tục bước được quyền thực hiện.",
        ],
        None,
        None,
        "Tạo một PYC cho một yêu cầu có phạm vi rõ ràng; nếu cần tách hồ sơ, thực hiện theo quy định nghiệp vụ thay vì ghi chồng dữ liệu.",
    )
    add_section_heading(doc, "5.4. Sổ tổng hợp và soạn thảo PGD", 2)
    add_bullets(doc, [
        "Sổ tổng hợp PGD dùng để lọc theo trạng thái, người phụ trách, khách hàng và nhóm hàng hóa; dùng để điều phối và giám sát.",
        "Soạn thảo tài liệu PGD dùng template biên bản/báo cáo/chứng thư đã được cấu hình; luôn mở bản sinh ra để kiểm tra trước khi ký.",
        "Khi lập biên bản hiện trường, bảo đảm tài liệu và mẫu liên kết đúng số GD/PYC, ngày, địa điểm và người tham gia.",
    ])


def add_admin(doc):
    add_section_heading(doc, "6. Quản trị hệ thống", 1, "quan-tri")
    add_paragraph(doc, "Các chức năng trong chương này ưu tiên cho Admin và người lãnh đạo được ủy quyền. Người dùng nghiệp vụ thường chỉ cần đọc các cấu hình liên quan, không tự ý thay đổi.")
    feature(
        doc,
        "6.1. Hồ sơ mẫu và revision workflow",
        "Quản lý bộ hồ sơ mẫu, node workflow, loại tài liệu bắt buộc và phạm vi PCN/PGD.",
        [
            "Chọn Hồ sơ mẫu.",
            "Chọn tab PCN · Chứng nhận hoặc PGD · Giám định.",
            "Tìm bộ hồ sơ và lọc theo trạng thái Bản nháp, Đang áp dụng hoặc Đã ngừng.",
            "Mở revision để kiểm tra node, nối, loại tài liệu và phạm vi áp dụng.",
            "Chọn Tạo revision khi cần phát triển phiên bản mới; chỉ Ngừng áp dụng khi đã đánh giá ảnh hưởng.",
            "Sau khi áp dụng, kiểm tra thử một hồ sơ mới để bảo đảm task và checklist hiển thị đúng.",
        ],
        "16-dossier-templates.png",
        "Hình 17. Quản lý hồ sơ mẫu PCN/PGD và revision workflow.",
        "Không thay đổi bộ hồ sơ mẫu đang áp dụng nếu chưa có kế hoạch chuyển tiếp cho các hồ sơ đang chạy.",
    )
    feature(
        doc,
        "6.2. Nhân sự, role và scope",
        "Cập nhật tài khoản, role hệ thống, chức vụ phòng ban và lĩnh vực được phân công.",
        [
            "Chọn Cài đặt hệ thống.",
            "Mở khu vực tài khoản nhân sự để xem danh sách và trạng thái tài khoản.",
            "Chọn người dùng cần cấu hình; gán systemRole phù hợp: admin, staff hoặc viewer.",
            "Chọn departmentRoleCode: Leadership, Certification Expert, Technical Reviewer, Sample Coordinator, Document Clerk hoặc Unassigned.",
            "Gán departmentScopes/fieldCodes phù hợp, đặc biệt QC4/QC9 và miền PCN/PGD.",
            "Lưu và yêu cầu người dùng đăng nhập lại để kiểm tra menu/quyền.",
        ],
        "13-system-settings.png",
        "Hình 18. Cài đặt hệ thống: nhân sự, role, phạm vi và cấu hình.",
        "Phân quyền theo nguyên tắc tối thiểu cần thiết. Không dùng role admin để giải quyết tạm thời lỗi scope.",
    )
    feature(
        doc,
        "6.3. Cấu hình PCN/PGD, template và OCR",
        "Quản lý tham số nghiệp vụ, DOCX template, OCR và kho lưu file riêng.",
        [
            "Trong Cài đặt hệ thống, mở từng nhóm cấu hình theo miền PCN hoặc PGD.",
            "Kiểm tra quy tắc mã, loại tài liệu, template và quyền ký trước khi cập nhật.",
            "Kiểm tra cấu hình OCR/API theo chính sách bảo mật; không đưa key vào tài liệu hướng dẫn.",
            "Kiểm tra private bucket/kho file và khả năng truy cập file từ hồ sơ.",
            "Sau thay đổi, dùng hồ sơ thử nghiệm để tạo tài liệu và xác nhận kết quả.",
        ],
        None,
        None,
        "Mọi thay đổi cấu hình phải được ghi nhận trong nhật ký và có phương án quay lại khi cần.",
    )


def add_ai_logs(doc):
    add_section_heading(doc, "7. Trợ lý AI và nhật ký hoạt động", 1, "ai-nhat-ky")
    feature(
        doc,
        "7.1. Trợ lý AI",
        "Hỗ trợ đọc và rà soát hồ sơ; AI không thay thế phê duyệt, ký hoặc chuyển trạng thái.",
        [
            "Chọn Trợ lý AI.",
            "Chọn miền PCN/PGD, hồ sơ và lĩnh vực nếu màn hình yêu cầu.",
            "Đọc kết quả gợi ý, điểm thiếu, tài liệu cần bổ sung hoặc cảnh báo dữ liệu.",
            "Đối chiếu mọi gợi ý với hồ sơ gốc, tiêu chuẩn và quy định nghiệp vụ.",
            "Tự thực hiện thao tác nghiệp vụ bằng các màn hình chính; không coi kết quả AI là quyết định cuối cùng.",
        ],
        "14-ai-assistant.png",
        "Hình 19. Trợ lý AI ở chế độ hỗ trợ rà soát hồ sơ.",
        "AI là lớp hỗ trợ đọc/kiểm tra. Quyết định nghiệp vụ, kết luận kỹ thuật và phê duyệt vẫn do người có thẩm quyền thực hiện.",
    )
    feature(
        doc,
        "7.2. Nhật ký hoạt động",
        "Truy nguyên ai đã làm gì, trên đối tượng nào, khi nào và thuộc miền PCN/PGD nào.",
        [
            "Chọn Nhật ký hoạt động.",
            "Lọc theo miền nghiệp vụ PCN/PGD, người dùng, hành động, đối tượng và kỳ thống kê.",
            "Đọc KPI theo người dùng để nhận biết phân bổ công việc.",
            "Đọc danh sách sự kiện: tạo mới, cập nhật, đổi trạng thái, giao việc, nhập dữ liệu, cấu hình.",
            "Chọn một dòng để xem mô tả chi tiết; dùng Xuất CSV khi cần đối soát.",
        ],
        "15-activity-logs.png",
        "Hình 20. Nhật ký hoạt động và bộ lọc truy nguyên.",
        "Khi báo lỗi, luôn cung cấp mã hồ sơ, thời điểm và mô tả sự kiện trong nhật ký; không gửi kèm mật khẩu hoặc API key.",
    )


def add_quick_recipes(doc):
    add_section_heading(doc, "8. Quy trình nhanh theo từng vai trò", 1, "quy-trinh-nhanh")
    add_paragraph(doc, "Các checklist dưới đây là đường tắt cho công việc hằng ngày. Nếu có khác biệt giữa checklist và workflow đang áp dụng, ưu tiên trạng thái, task và tài liệu bắt buộc hiển thị trong hồ sơ.")
    recipes = [
        ("Admin hệ thống", [
            "Đăng nhập → kiểm tra dashboard và thông báo.",
            "Kiểm tra nhân sự/role/scope trong Cài đặt hệ thống.",
            "Kiểm tra revision hồ sơ mẫu đang áp dụng.",
            "Theo dõi Nhật ký hoạt động và tình trạng backup/kho file.",
        ]),
        ("Lãnh đạo / phê duyệt", [
            "Dashboard → lọc hồ sơ cần xem xét hoặc phê duyệt.",
            "Mở hồ sơ → đọc checklist, KQTN, tài liệu và lịch sử.",
            "Giao việc hoặc phê duyệt đúng node; không phê duyệt khi thiếu tài liệu bắt buộc.",
            "Kiểm tra phát hành/trả kết quả và nhật ký sau thao tác.",
        ]),
        ("Certification Expert", [
            "Đề nghị → kiểm tra khách hàng/sản phẩm/lĩnh vực.",
            "Tạo hoặc mở hồ sơ PCN → hoàn thiện metadata và task intake.",
            "Tạo lô mẫu/PYC, theo dõi KQTN và cập nhật checklist.",
            "Soạn tài liệu và chuyển bước xem xét khi đủ điều kiện.",
        ]),
        ("Technical Reviewer", [
            "Mở hồ sơ được giao → xem tài liệu, KQTN và lịch sử thay đổi.",
            "Đối chiếu yêu cầu kỹ thuật, phạm vi QC4/QC9 và kết luận.",
            "Ghi nhận thiếu/sai hoặc hoàn tất soát xét.",
            "Chuyển sang phê duyệt chỉ khi kết luận và tài liệu nhất quán.",
        ]),
        ("Sample Coordinator", [
            "Sổ quản lý mẫu → kiểm tra lô và tuyến phòng thử.",
            "Tạo PYC tổng, thêm PYC con theo từng phòng thử.",
            "Gửi một lần, theo dõi ACK/RECEIVED/SCHEDULED/IN_PROGRESS/TEST_COMPLETED.",
            "Retry chỉ khi có nguyên nhân rõ ràng; đối soát nhật ký sau retry.",
        ]),
        ("Document Clerk", [
            "Mở hồ sơ → kiểm tra tài liệu bắt buộc và người ký.",
            "Soạn thảo tài liệu → lưu bản nháp → sinh DOCX/PDF.",
            "Kiểm tra bản sinh ra, đính kèm vào hồ sơ và chuyển đúng bước.",
            "Sau phát hành/giao trả, bảo đảm file và nhật ký đầy đủ.",
        ]),
        ("Viewer", [
            "Dùng dashboard, sổ, hồ sơ, thông báo và nhật ký để tra cứu.",
            "Không thao tác các nút tạo/lưu/gửi/chuyển trạng thái/phê duyệt.",
            "Gửi yêu cầu thay đổi kèm mã hồ sơ và mô tả cụ thể cho người có quyền.",
        ]),
    ]
    for role, steps in recipes:
        add_section_heading(doc, role, 2)
        add_steps(doc, steps)


def add_troubleshooting(doc):
    add_section_heading(doc, "9. Xử lý lỗi và kiểm soát dữ liệu", 1, "xu-ly-loi")
    rows = [
        ("Không thấy menu PCN/PGD", "Kiểm tra role, departmentScopes, fieldCodes và đăng nhập lại."),
        ("Không thấy nút hành động", "Kiểm tra quyền, người được giao, trạng thái workflow và tài liệu bắt buộc."),
        ("Không tìm thấy hồ sơ", "Xóa bộ lọc, tìm theo mã chính xác, kiểm tra đúng miền PCN/PGD và scope."),
        ("Gửi PYC nhưng chưa có phản hồi", "Không gửi lặp; kiểm tra trạng thái tuyến, nhật ký tích hợp và liên hệ đầu mối PTN."),
        ("KQTN sai hồ sơ", "Dừng phê duyệt, đối chiếu mã PYC/lô/phòng thử, ghi nhận nhật ký và chuyển người phụ trách."),
        ("DOCX/PDF sinh sai", "Kiểm tra template, metadata nguồn, người ký; sửa bản nháp và sinh lại theo quyền."),
        ("Dữ liệu sổ chưa cập nhật", "Tải lại sổ, kiểm tra thông báo và nhật ký; không tạo bản ghi trùng để bù."),
        ("Bị từ chối quyền", "Ghi lại mã hồ sơ, thao tác, thời điểm và lỗi; gửi cho Admin/Leadership để kiểm tra RBAC."),
    ]
    add_table(doc, ["Tình huống", "Cách xử lý ưu tiên"], rows, widths=[5.0, 13.0], font_size=8.5)
    add_callout(doc, "Checklist trước khi kết thúc", "Đúng mã hồ sơ • Đúng khách hàng/sản phẩm • Đúng lĩnh vực • Đủ tài liệu bắt buộc • Đúng người xử lý • Đã kiểm tra trạng thái • Đã để lại nhật ký.", fill="EAF6EF", label_color="287A4B")
    add_section_heading(doc, "9.1. Đăng xuất an toàn", 2)
    add_steps(doc, [
        "Hoàn tất hoặc lưu bản nháp đúng quy trình; không đóng trình duyệt giữa thao tác gửi/lưu.",
        "Kiểm tra thông báo hoặc cảnh báo lỗi còn lại.",
        "Chọn Đăng xuất ở khu vực tài khoản người dùng.",
        "Nếu dùng máy chung, đóng toàn bộ cửa sổ trình duyệt sau khi xác nhận đã về màn hình đăng nhập.",
    ])
    add_callout(doc, "Hỗ trợ", "Khi liên hệ hỗ trợ, gửi: tên tài khoản, mã hồ sơ/PYC, thao tác vừa thực hiện, thời gian xảy ra lỗi, ảnh lỗi đã che thông tin mật và mã sự kiện trong Nhật ký hoạt động.", fill="F3F7FA", label_color=TEAL)


def build():
    doc = Document()
    configure_document(doc)
    add_cover(doc)
    add_contents(doc)
    add_intro(doc)
    add_roles(doc)
    add_common(doc)
    add_pcn(doc)
    add_pgd(doc)
    add_admin(doc)
    add_ai_logs(doc)
    add_quick_recipes(doc)
    add_troubleshooting(doc)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT))
    print(OUT)


if __name__ == "__main__":
    build()
