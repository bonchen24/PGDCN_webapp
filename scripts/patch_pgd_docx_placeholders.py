from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import html
import os
import tempfile


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / 'templates' / 'pgd'

MISSING = {
    'PGD-BM-01.docx': ['countryOfOrigin', 'hsCode', 'lotDefinition', 'manufacturerLotCode', 'productForm'],
    'PGD-BM-03.docx': ['countryOfOrigin', 'customsDocuments', 'dimensions', 'grade', 'hsCode', 'importer', 'lotDefinition', 'manufacturer', 'manufacturerLotCode', 'origin', 'productForm', 'productStandard'],
    'PGD-BM-04.docx': ['countryOfOrigin', 'customsDocuments', 'dimensions', 'grade', 'hsCode', 'importer', 'lotDefinition', 'manufacturer', 'manufacturerLotCode', 'origin', 'productForm', 'productStandard'],
    'PGD-BM-05.docx': ['countryOfOrigin', 'customsDocuments', 'dimensions', 'grade', 'hsCode', 'importer', 'lotDefinition', 'manufacturer', 'manufacturerLotCode', 'origin', 'productForm', 'productStandard'],
    'PGD-BM-07.docx': ['countryOfOrigin', 'hsCode', 'lotDefinition', 'manufacturerLotCode', 'productForm', 'steelLotSize', 'steelManualSamplingPlanNote', 'steelSameGradeMultiProduct'],
    'PGD-BM-08.docx': ['countryOfOrigin', 'hsCode', 'lotDefinition', 'manufacturerLotCode', 'productForm'],
    'PGD-BM-09.docx': ['countryOfOrigin', 'hsCode', 'lotDefinition', 'manufacturerLotCode', 'productForm'],
}


def patch_document(path: Path, keys: list[str]) -> None:
    with ZipFile(path, 'r') as source:
        parts = {info.filename: source.read(info.filename) for info in source.infolist()}
    document = parts['word/document.xml'].decode('utf-8')
    if all(f'[[{key}]]' in document for key in keys):
        return
    escaped = html.escape('Bổ sung thông tin lô/sản phẩm: ' + ' · '.join(f'{key}: [[{key}]]' for key in keys))
    paragraph = (
        '<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{escaped}</w:t></w:r></w:p>'
    )
    marker = '</w:body>'
    if marker not in document:
        raise RuntimeError(f'Không tìm thấy w:body trong {path.name}')
    parts['word/document.xml'] = document.replace(marker, paragraph + marker, 1).encode('utf-8')
    fd, temp_name = tempfile.mkstemp(prefix=path.stem + '-', suffix='.docx', dir=path.parent)
    os.close(fd)
    temp_path = Path(temp_name)
    try:
        with ZipFile(temp_path, 'w', ZIP_DEFLATED) as target:
            for name, payload in parts.items():
                target.writestr(name, payload)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


for file_name, keys in MISSING.items():
    patch_document(TEMPLATE_DIR / file_name, keys)
