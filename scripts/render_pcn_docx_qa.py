"""Render every checked-in PCN DOCX with the document skill renderer."""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RENDERER = Path(
    r"C:\Users\HungX\.codex\plugins\cache\openai-primary-runtime\documents\26.909.12148\skills\documents\render_docx.py"
)


def main() -> None:
    os.environ["PATH"] = r"C:\Program Files\LibreOffice\program" + os.pathsep + os.environ.get("PATH", "")
    spec = importlib.util.spec_from_file_location("codex_docx_renderer", RENDERER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load renderer: {RENDERER}")
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    output_root = ROOT / "tmp" / "docx-qa"
    for docx_path in sorted((ROOT / "templates" / "pcn").glob("PCN_*.docx")):
        output_dir = output_root / docx_path.stem
        output_dir.mkdir(parents=True, exist_ok=True)
        renderer.rasterize(str(docx_path), str(output_dir), 150, verbose=False, emit_pdf=True)
        print(f"RENDERED {docx_path.name}")


if __name__ == "__main__":
    main()
