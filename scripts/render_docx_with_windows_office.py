"""Run the document skill renderer with the installed Windows LibreOffice binary."""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: render_docx_with_windows_office.py INPUT.docx OUTPUT_DIR")
    renderer = Path(
        r"C:\Users\HungX\.codex\plugins\cache\openai-primary-runtime\documents\26.909.12148\skills\documents\render_docx.py"
    )
    office_dir = r"C:\Program Files\LibreOffice\program"
    os.environ["PATH"] = office_dir + os.pathsep + os.environ.get("PATH", "")
    sys.argv = [str(renderer), sys.argv[1], "--output_dir", sys.argv[2], "--emit_pdf"]
    runpy.run_path(str(renderer), run_name="__main__")


if __name__ == "__main__":
    main()
