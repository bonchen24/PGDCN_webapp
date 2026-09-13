from __future__ import annotations

import argparse
import copy
import json
import re
import unicodedata
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor
from docx.text.paragraph import Paragraph


MM_TO_TWIPS = 56.6929133858
BODY_SIZE = Pt(13)
HEADING_SIZE = Pt(14)
PAGE_NUMBER_SIZE = Pt(13)


TEXT_REPLACEMENTS = (
    ("–", "-"),
    ("—", "-"),
    ("THAN- KHOÁNG", "THAN - KHOÁNG"),
    ("MỎ- VINACOMIN", "MỎ - VINACOMIN"),
    ("Mỏ- Vinacomin", "Mỏ - Vinacomin"),
    ("mỏ- Vinacomin", "mỏ - Vinacomin"),
    ("Bill of ladding", "Bill of Lading"),
    ("Phiếu kết qủa", "Phiếu kết quả"),
    ("Hoá đơn", "Hóa đơn"),
    ("CỘNG HOÀ", "CỘNG HÒA"),
    ("nôi dung", "nội dung"),
    ("chứng nhậncho", "chứng nhận cho"),
    ("một một số", "một số"),
    ("lạị", "lại"),
    ("yêu cầu giám khi", "yêu cầu giám định khi"),
    ("Tiêu chuẩn kỹ thuật .", "Tiêu chuẩn kỹ thuật."),
    ("kết quả chứng nhận .", "kết quả chứng nhận."),
    ("Quyết định này có hiệu lực kể từ ngày ký .", "Quyết định này có hiệu lực kể từ ngày ký."),
    ("Đánh giá viên/ Chứng nhận viên", "Đánh giá viên/Chứng nhận viên"),
    ("Tổ chức/ cá nhân", "Tổ chức/cá nhân"),
    ("Bộ Luật Dân sự", "Bộ luật Dân sự"),
    ("Luật chất lượng sản phẩm, hàng hóa", "Luật Chất lượng sản phẩm, hàng hóa"),
)


def all_paragraphs(container):
    """Yield paragraphs in a document-like container, including nested tables."""
    for paragraph in getattr(container, "paragraphs", []):
        yield paragraph
    for table in getattr(container, "tables", []):
        for row in table.rows:
            for cell in row.cells:
                yield from all_paragraphs(cell)


def all_runs(container):
    for paragraph in all_paragraphs(container):
        for run in paragraph.runs:
            yield run


def font_name(run, name="Times New Roman"):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for key in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn(f"w:{key}"), name)


def black_font(run, size=BODY_SIZE):
    font_name(run)
    run.font.size = size
    run.font.color.rgb = RGBColor(0, 0, 0)


def run_has_field(run):
    return any(child.tag in (qn("w:fldChar"), qn("w:instrText")) for child in run._element.iter())


def run_has_symbol(run):
    return any(child.tag == qn("w:sym") for child in run._element.iter())


def replace_in_paragraph(paragraph):
    """Apply text fixes while preserving run boundaries and formatting."""
    for run in paragraph.runs:
        if run_has_field(run) or run_has_symbol(run):
            continue
        original = run.text or ""
        text = unicodedata.normalize("NFC", original)
        for old, new in TEXT_REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            run.text = text

    # Handle the uncommon case where a typo is split between two Word runs.
    for old, new in TEXT_REPLACEMENTS:
        while old in paragraph.text:
            runs = list(paragraph.runs)
            full = "".join(r.text or "" for r in runs)
            start = full.find(old)
            if start < 0:
                break
            end = start + len(old)
            cursor = 0
            start_run = end_run = None
            start_offset = end_offset = 0
            for index, run in enumerate(runs):
                text = run.text or ""
                next_cursor = cursor + len(text)
                if start_run is None and cursor <= start < next_cursor:
                    start_run = index
                    start_offset = start - cursor
                if cursor < end <= next_cursor:
                    end_run = index
                    end_offset = end - cursor
                    break
                cursor = next_cursor
            if start_run is None or end_run is None:
                break
            if start_run == end_run:
                runs[start_run].text = (runs[start_run].text or "")[:start_offset] + new + (runs[start_run].text or "")[end_offset:]
            else:
                first = runs[start_run].text or ""
                last = runs[end_run].text or ""
                runs[start_run].text = first[:start_offset] + new
                for index in range(start_run + 1, end_run):
                    runs[index].text = ""
                runs[end_run].text = last[end_offset:]


def clean_trailing_punctuation(paragraph, punctuation):
    runs = list(paragraph.runs)
    for run in reversed(runs):
        text = run.text or ""
        if not text.strip():
            continue
        stripped = text.rstrip()
        suffix = text[len(stripped):]
        stripped = re.sub(r"[;:.]+$", "", stripped).rstrip()
        run.text = stripped + punctuation + suffix
        break


def is_heading(text):
    text = " ".join(text.split())
    if not text:
        return False
    letters = [c for c in text if c.isalpha()]
    upper_ratio = sum(c.isupper() for c in letters) / max(len(letters), 1)
    if len(letters) >= 4 and upper_ratio > 0.82:
        return True
    if re.match(r"^(?:\d+(?:\.\d+)*[A-Z]?|[IVX]+)[.)]?(?:\s|$)", text):
        return len(text) < 120
    return False


def likely_form_label(text):
    text = " ".join(text.split())
    if not text:
        return True
    if text.startswith(("- ", "• ", "(*)", "(**")):
        return True
    if len(text) <= 85 and ":" in text:
        return True
    if len(text) <= 55 and "[[" in text:
        return True
    return False


def likely_form_line(text):
    return (
        "\t" in text
        or "…" in text
        or text.count(".") >= 5
        or "□" in text
        or "\uf0a8" in text
    )


def format_paragraph(paragraph, in_table=False, in_header=False):
    text = " ".join(paragraph.text.split())
    heading = is_heading(text)
    form_line = likely_form_line(paragraph.text)
    size = HEADING_SIZE if heading else BODY_SIZE
    for run in paragraph.runs:
        black_font(run, size)

    fmt = paragraph.paragraph_format
    fmt.line_spacing = 1.0 if in_table or in_header else Pt(18)
    fmt.line_spacing_rule = WD_LINE_SPACING.SINGLE if in_table or in_header else WD_LINE_SPACING.EXACTLY
    fmt.space_before = Pt(0)
    fmt.space_after = Pt(0 if in_table or in_header else 6)
    fmt.left_indent = Mm(0)
    fmt.right_indent = Mm(0)
    fmt.first_line_indent = Mm(0)

    if in_header:
        return
    if heading:
        fmt.first_line_indent = Mm(0)
        if paragraph.alignment is None:
            fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
        return
    if in_table:
        ppr = paragraph._p.get_or_add_pPr()
        if ppr.find(qn("w:numPr")) is not None and paragraph.text.strip():
            tabs = ppr.find(qn("w:tabs"))
            if tabs is not None:
                ppr.remove(tabs)
        return
    if likely_form_label(text) or form_line:
        fmt.alignment = WD_ALIGN_PARAGRAPH.LEFT
        return
    fmt.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    fmt.first_line_indent = Mm(10)


def scale_table_to_body_width(table, body_width_twips):
    grid = table._tbl.tblGrid
    grid_cols = list(grid)
    widths = []
    for grid_col in grid_cols:
        raw = grid_col.get(qn("w:w"))
        widths.append(int(raw) if raw else 0)
    total = sum(widths)
    if not widths or total <= 0:
        return
    factor = body_width_twips / total
    scaled_widths = [max(1, round(width * factor)) for width in widths]
    scaled_widths[-1] = max(1, scaled_widths[-1] + body_width_twips - sum(scaled_widths))
    for grid_col, width in zip(grid_cols, scaled_widths):
        grid_col.set(qn("w:w"), str(width))

    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.insert(0, tbl_w)
    tbl_w.set(qn("w:w"), str(body_width_twips))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "0")
    tbl_ind.set(qn("w:type"), "dxa")

    tbl_jc = tbl_pr.find(qn("w:jc"))
    if tbl_jc is None:
        tbl_jc = OxmlElement("w:jc")
        tbl_pr.append(tbl_jc)
    tbl_jc.set(qn("w:val"), "left")

    seen = set()
    for row in table.rows:
        for cell in row.cells:
            tc = cell._tc
            if id(tc) in seen:
                continue
            seen.add(id(tc))
            tc_pr = tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                continue
            raw = tc_w.get(qn("w:w"))
            if not raw:
                continue
            tc_w.set(qn("w:w"), str(max(1, round(int(raw) * factor))))


def align_header_table_to_body(table, body_width_twips):
    """Align a header table with the page text block instead of a template offset."""
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.insert(0, tbl_w)
    tbl_w.set(qn("w:w"), str(body_width_twips))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "0")
    tbl_ind.set(qn("w:type"), "dxa")

    tbl_jc = tbl_pr.find(qn("w:jc"))
    if tbl_jc is None:
        tbl_jc = OxmlElement("w:jc")
        tbl_pr.append(tbl_jc)
    tbl_jc.set(qn("w:val"), "left")


def normalize_option_line(paragraph):
    text = paragraph.text
    is_certificate_options = "Cấp chứng chỉ" in text and "Thu hồi" in text
    is_audit_options = "Đáp ứng" in text and "Không Đáp ứng" in text
    if not is_certificate_options and not is_audit_options:
        return
    for run in paragraph.runs:
        if run_has_field(run) or run_has_symbol(run):
            continue
        run.text = re.sub(r"[ \t]{3,}", "  ", (run.text or "").replace("\t", " "))
        if is_audit_options:
            # These checkbox rows are dense form controls; 12 pt keeps the
            # complete option pair on one line while leaving body text at 13 pt.
            run.font.size = Pt(12)
    paragraph.paragraph_format.left_indent = Mm(0)
    paragraph.paragraph_format.right_indent = Mm(0)
    paragraph.paragraph_format.first_line_indent = Mm(0)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT


def normalize_known_leaders(paragraph):
    text = paragraph.text
    if "Số điểm không phù hợp" not in text and "Số điểm khuyến nghị" not in text:
        return
    for run in paragraph.runs:
        if run_has_field(run):
            continue
        run.text = re.sub(r"\.{8,}", "." * 45, run.text or "")
    paragraph.paragraph_format.left_indent = Mm(0)
    paragraph.paragraph_format.right_indent = Mm(0)
    paragraph.paragraph_format.first_line_indent = Mm(0)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT


def normalize_bia_so_page_labels(doc):
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if " ".join(cell.text.split()) != "Số trang":
                    continue
                for paragraph in cell.paragraphs:
                    if " ".join(paragraph.text.split()) == "Số trang" and paragraph.runs:
                        paragraph.runs[0].text = "Số\ntrang"
                        for run in paragraph.runs:
                            # The label sits in a deliberately narrow metadata
                            # column; use a compact size so "trang" is not split.
                            black_font(run, Pt(11))


def set_column_width(table, index, width_mm):
    twips = round(width_mm * MM_TO_TWIPS)
    grid_cols = list(table._tbl.tblGrid)
    if index < len(grid_cols):
        grid_cols[index].set(qn("w:w"), str(twips))
    for row in table.rows:
        if index >= len(row.cells):
            continue
        cell = row.cells[index]
        tc_pr = cell._tc.get_or_add_tcPr()
        tc_w = tc_pr.find(qn("w:tcW"))
        if tc_w is None:
            tc_w = OxmlElement("w:tcW")
            tc_pr.insert(0, tc_w)
        tc_w.set(qn("w:w"), str(twips))
        tc_w.set(qn("w:type"), "dxa")


def set_table_layout_fixed(table):
    """Keep Word from reflowing a table beyond the 165 mm text block."""
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    layout = tbl_pr.find(qn("w:tblLayout"))
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        tbl_pr.append(layout)
    layout.set(qn("w:type"), "fixed")


def set_table_column_widths(table, widths_mm):
    """Assign a deliberate width profile while preserving merged-cell layout."""
    grid_cols = list(table._tbl.tblGrid)
    if len(grid_cols) != len(widths_mm):
        return
    for index, width_mm in enumerate(widths_mm):
        set_column_width(table, index, width_mm)
    set_table_layout_fixed(table)


def prevent_cell_wrap(cell):
    tc_pr = cell._tc.get_or_add_tcPr()
    no_wrap = tc_pr.find(qn("w:noWrap"))
    if no_wrap is None:
        no_wrap = OxmlElement("w:noWrap")
        tc_pr.append(no_wrap)


def normalize_compact_table_columns(doc, source_name):
    for table in doc.tables:
        header = " | ".join(" ".join(cell.text.split()) for cell in table.rows[0].cells) if table.rows else ""
        if source_name == "PCN_Bien_ban_lay_mau.docx" and "Số lượng mẫu" in header:
            set_column_width(table, 1, 31)
            set_column_width(table, 3, 40)
        if source_name == "PCN_Bien_ban_giao_nhan_mau.docx" and "Số lượng" in header:
            # Keep [[so_luong_mau]] intact in the quantity column.
            set_column_width(table, 2, 45)
            if len(table.rows) > 1 and len(table.rows[1].cells) > 2:
                prevent_cell_wrap(table.rows[1].cells[2])
        if source_name == "PCN_Bien_ban_ma_hoa_mau.docx" and "Số lượng" in header:
            set_column_width(table, 1, 38)
            set_column_width(table, 2, 40)
        if source_name == "PCN_Ke_hoach_danh_gia_CNSP.docx" and "Họ và tên" in header and "Điện thoại" in header:
            set_table_column_widths(table, [13, 46, 32, 36, 38])
        if source_name == "PCN_PYC_gui_PTN.docx" and "Mã hóa theo lô" in header:
            set_table_column_widths(table, [26, 27, 32, 27, 36, 17])


def normalize_pgd_table_columns(doc, source_name):
    """Use business-aware PGD column profiles instead of equal-width columns."""
    profiles = {
        "product-lines": [26, 18, 22, 25, 18, 26, 15, 15],
        "sample-handover": [40, 30, 15, 14, 34, 32],
        "sample-five": [29, 42, 19, 18, 57],
        "sample-four": [30, 58, 20, 57],
        "inspection-three": [42, 82, 41],
        "inspection-four": [23, 78, 34],
        "team": [62, 54, 49],
        "agenda": [23, 91, 51],
        "timeline-four": [23, 76, 36, 30],
        "activity-three": [22, 96, 47],
        "result-three": [49, 47, 69],
        "result-four": [48, 46, 18, 53],
        "two-column": [48, 117],
        "index-four": [23, 85, 34, 23],
    }

    def profile_for(header, count):
        if count == 8 and "Tên hàng" in header and "Mác thép" in header:
            return profiles["product-lines"]
        if count == 6 and "Tên / ký hiệu mẫu" in header:
            return profiles["sample-handover"]
        if count == 5 and "Mã mẫu" in header and "Xử lý mẫu" in header:
            return profiles["sample-five"]
        if count == 5 and "Mã mẫu" in header and "Niêm phong" in header:
            return profiles["sample-five"]
        if count == 4 and "Chỉ tiêu" in header and "Phương pháp" in header:
            return profiles["result-four"]
        if count == 4 and "Thời gian" in header and "Ghi chú" in header:
            return profiles["timeline-four"]
        if count == 4 and "Mã" in header and "Số trang" in header:
            return profiles["index-four"]
        if count == 4 and "Mã mẫu" in header and "Số lượng" in header:
            return profiles["sample-four"]
        if count == 3 and "Họ tên" in header and "Điện thoại" in header:
            return profiles["team"]
        if count == 3 and "Thời gian" in header and "Phụ trách" in header:
            return profiles["agenda"]
        if count == 3 and "Thời gian" in header and "Nhận xét" in header:
            return profiles["activity-three"]
        if count == 3 and "Hạng mục" in header and "Đơn vị" in header:
            return profiles["inspection-three"]
        if count == 3 and "Mã" in header and "Xử lý" in header:
            return profiles["inspection-three"]
        if count == 3 and "Hạng mục" in header and "Kết quả" in header:
            return profiles["result-three"]
        if count == 2 and "Trường bổ sung" in header:
            return profiles["two-column"]
        return None

    for table in doc.tables:
        header = " | ".join(" ".join(cell.text.split()) for cell in table.rows[0].cells) if table.rows else ""
        profile = profile_for(header, len(list(table._tbl.tblGrid)))
        if profile:
            set_table_column_widths(table, profile)


def normalize_assessment_customer_field(doc, source_name):
    """Keep the customer placeholder in the wide value cell, not the label cell."""
    if source_name != "PCN_Bao_cao_danh_gia_CNSP.docx" or not doc.tables:
        return
    table = doc.tables[0]
    if not table.rows or len(table.rows[0].cells) < 2:
        return
    label_cell = table.rows[0].cells[0]
    value_cell = table.rows[0].cells[1]
    token = "[[ten_cong_ty]]"
    label_paragraph = label_cell.paragraphs[0]
    value_paragraph = value_cell.paragraphs[0]
    if token not in label_paragraph.text or token in value_paragraph.text:
        return
    for run in label_paragraph.runs:
        run.text = (run.text or "").replace(token, "")
    if label_paragraph.runs:
        label_paragraph.runs[-1].text = label_paragraph.runs[-1].text.rstrip()
    appended = value_paragraph.add_run(" " + token)
    appended.bold = True
    black_font(appended, BODY_SIZE)
    value_paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT


def normalize_pcn_proposal_terminology(doc, source_name):
    """Keep the certification proposal from inheriting the inspection term."""
    if source_name != "PCN_De_nghi_chung_nhan.docx":
        return
    for paragraph in all_paragraphs(doc):
        for run in paragraph.runs:
            run.text = (run.text or "").replace("yêu cầu giám định khi", "yêu cầu chứng nhận khi")


def paragraph_in_table(paragraph):
    parent = paragraph._element.getparent()
    while parent is not None:
        if parent.tag == qn("w:tbl"):
            return True
        parent = parent.getparent()
    return False


def copy_header_to_first_page(section):
    """Copy a primary header, including image and hyperlink relationships."""
    source = section.header
    first = section.first_page_header
    source_el = source._element
    target_el = first._element
    for child in list(target_el):
        target_el.remove(child)

    rel_map = {}
    for rid, rel in source.part.rels.items():
        try:
            rel_map[rid] = first.part.relate_to(rel._target, rel.reltype, is_external=rel.is_external)
        except Exception:
            continue

    for child in source_el:
        clone = copy.deepcopy(child)
        for element in clone.iter():
            for attr, value in list(element.attrib.items()):
                if value in rel_map:
                    element.set(attr, rel_map[value])
        target_el.append(clone)


def clear_paragraph(paragraph):
    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)


def add_page_field(paragraph):
    clear_paragraph(paragraph)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1.0
    run = paragraph.add_run()
    black_font(run, PAGE_NUMBER_SIZE)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    result = OxmlElement("w:t")
    result.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, result, end])


def _run_has_field_char(run_element, field_type):
    for child in run_element:
        if child.tag == qn("w:fldChar") and child.get(qn("w:fldCharType")) == field_type:
            return True
    return False


def remove_page_fields(container):
    """Remove PAGE fields from a first-page header while preserving other content."""
    root = container._element

    for simple in list(root.iter(qn("w:fldSimple"))):
        if "PAGE" in (simple.get(qn("w:instr")) or "").upper():
            parent = simple.getparent()
            if parent is not None:
                parent.remove(simple)

    for paragraph in list(root.iter(qn("w:p"))):
        children = list(paragraph)
        index = 0
        while index < len(children):
            child = children[index]
            if child.tag != qn("w:r"):
                index += 1
                continue
            has_page_instruction = any(
                node.tag == qn("w:instrText") and "PAGE" in (node.text or "").upper()
                for node in child
            )
            if not has_page_instruction:
                index += 1
                continue

            start = index
            for candidate in range(index - 1, -1, -1):
                if children[candidate].tag == qn("w:r") and _run_has_field_char(children[candidate], "begin"):
                    start = candidate
                    break
            end = index
            for candidate in range(index, len(children)):
                if children[candidate].tag == qn("w:r") and _run_has_field_char(children[candidate], "end"):
                    end = candidate
                    break
            for field_child in children[start:end + 1]:
                paragraph.remove(field_child)
            children = list(paragraph)
            index = max(0, start)


def container_has_page_field(container):
    """Return True when a header/footer already contains a PAGE field."""
    root = container._element
    for simple in root.iter(qn("w:fldSimple")):
        if "PAGE" in (simple.get(qn("w:instr")) or "").upper():
            return True
    for instr in root.iter(qn("w:instrText")):
        if "PAGE" in (instr.text or "").upper():
            return True
    return False


def ensure_header_page_number(header):
    """Add one centered PAGE field without disturbing logo/header tables."""
    # Normalization is rerunnable. Remove stale or duplicated PAGE fields first
    # so a second pass cannot stack another page number in the same header.
    remove_page_fields(header)
    if container_has_page_field(header):
        return
    first_paragraph = header.paragraphs[0] if header.paragraphs else None
    if first_paragraph is not None and not first_paragraph.text.strip() and not any("drawing" in run._element.xml for run in first_paragraph.runs):
        page_paragraph = first_paragraph
    else:
        page_paragraph = Paragraph(OxmlElement("w:p"), header)
        header._element.insert(0, page_paragraph._p)
    add_page_field(page_paragraph)


def ensure_page_number(section):
    was_different = section.different_first_page_header_footer
    if not was_different:
        section.different_first_page_header_footer = True
        copy_header_to_first_page(section)

    # The first page must not display a page number, including when the source
    # template already had a custom first-page header.
    remove_page_fields(section.first_page_header)
    for paragraph in all_paragraphs(section.first_page_header):
        if paragraph.text.strip() in {"Trang :/", "Trang:/", "Trang :"}:
            clear_paragraph(paragraph)

    # Number every subsequent page, including even pages in two-sided layouts.
    ensure_header_page_number(section.header)
    if section._document_part.document.settings.odd_and_even_pages_header_footer:
        ensure_header_page_number(section.even_page_header)


def style_legal_bases(doc):
    legal = []
    for paragraph in all_paragraphs(doc):
        text = " ".join(paragraph.text.split())
        if text.startswith("Căn cứ ") and len(text) > 45:
            legal.append(paragraph)
    for index, paragraph in enumerate(legal):
        clean_trailing_punctuation(paragraph, "." if index == len(legal) - 1 else ";")
        for run in paragraph.runs:
            run.italic = True
            run.bold = False


def normalize_doc(source, target):
    doc = Document(str(source))
    before_placeholders = sorted(set(re.findall(r"\[\[[^\]]+\]\]", "\n".join(p.text for p in all_paragraphs(doc)))))

    for section in doc.sections:
        section.page_width = Mm(210)
        section.page_height = Mm(297)
        section.top_margin = Mm(20)
        section.bottom_margin = Mm(20)
        section.left_margin = Mm(30)
        section.right_margin = Mm(15)
        section.header_distance = Mm(8)
        section.footer_distance = Mm(10)
    for run in all_runs(doc):
        if not run_has_field(run):
            original = run.text or ""
            normalized = unicodedata.normalize("NFC", original)
            if normalized != original:
                run.text = normalized

    for paragraph in all_paragraphs(doc):
        replace_in_paragraph(paragraph)
        format_paragraph(paragraph, in_table=paragraph_in_table(paragraph))
        normalize_option_line(paragraph)
        normalize_known_leaders(paragraph)

    for section in doc.sections:
        for container in (section.header, section.first_page_header, section.footer, section.first_page_footer):
            for paragraph in all_paragraphs(container):
                replace_in_paragraph(paragraph)
                format_paragraph(paragraph, in_header=True)

    body_width_twips = round(165 * MM_TO_TWIPS)
    for table in doc.tables:
        scale_table_to_body_width(table, body_width_twips)
        set_table_layout_fixed(table)
    for section in doc.sections:
        for container in (section.header, section.first_page_header, section.footer, section.first_page_footer):
            for table in container.tables:
                scale_table_to_body_width(table, body_width_twips)
                set_table_layout_fixed(table)
                if container in (section.header, section.first_page_header):
                    align_header_table_to_body(table, body_width_twips)

    if source.name == "PCN_Bia_ho_so.docx":
        normalize_bia_so_page_labels(doc)
    normalize_compact_table_columns(doc, source.name)
    if source.parent.name.lower() == "pgd":
        normalize_pgd_table_columns(doc, source.name)
    normalize_assessment_customer_field(doc, source.name)
    normalize_pcn_proposal_terminology(doc, source.name)

    # Refit once more after template-specific column adjustments so every
    # body table still starts at 30 mm and ends at 15 mm.
    for table in doc.tables:
        scale_table_to_body_width(table, body_width_twips)
        set_table_layout_fixed(table)
    for section in doc.sections:
        for container in (section.header, section.first_page_header, section.footer, section.first_page_footer):
            for table in container.tables:
                scale_table_to_body_width(table, body_width_twips)
                set_table_layout_fixed(table)

    style_legal_bases(doc)

    for style_name in ("Normal", "Body Text", "Header", "Footer"):
        try:
            style = doc.styles[style_name]
        except KeyError:
            continue
        style.font.name = "Times New Roman"
        style.font.size = BODY_SIZE
        style.font.color.rgb = RGBColor(0, 0, 0)
        style._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
        style._element.rPr.rFonts.set(qn("w:cs"), "Times New Roman")

    # Add the page field only after all text normalization is complete. This
    # prevents a later run.text assignment from flattening the field code.
    for section in doc.sections:
        ensure_page_number(section)

    after_placeholders = sorted(set(re.findall(r"\[\[[^\]]+\]\]", "\n".join(p.text for p in all_paragraphs(doc)))))
    if before_placeholders != after_placeholders:
        raise RuntimeError(f"Placeholder contract changed for {source.name}: {before_placeholders} != {after_placeholders}")

    target.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(target))
    return {
        "source": str(source),
        "output": str(target),
        "placeholders": len(after_placeholders),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("revised_templates"))
    args = parser.parse_args()

    root = args.root.resolve()
    output = (root / args.output).resolve() if not args.output.is_absolute() else args.output
    files = sorted(list((root / "templates" / "pcn").glob("*.docx")) + list((root / "templates" / "pgd").glob("*.docx")))
    if len(files) != 32:
        raise RuntimeError(f"Expected 32 source templates, found {len(files)}")

    report = []
    for source in files:
        relative = source.relative_to(root)
        target = output / relative.relative_to("templates")
        report.append(normalize_doc(source, target))

    output.mkdir(parents=True, exist_ok=True)
    (output / "normalization_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"count": len(report), "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
