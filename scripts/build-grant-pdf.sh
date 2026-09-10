#!/usr/bin/env bash
# Render docs/grant-proposal-2026-09-10.md to docs/grant-proposal-2026-09-10.pdf.
# Markdown -> HTML with the Python `markdown` package; HTML -> PDF with headless Chrome (Letter, margins).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=docs/grant-proposal-2026-09-10.md
HTML=out/grant-proposal-2026-09-10.html
PDF=docs/grant-proposal-2026-09-10.pdf
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p out
python3 - "$SRC" "$HTML" <<'EOF'
import sys, markdown, base64, pathlib
src, out = sys.argv[1], sys.argv[2]
body = markdown.markdown(pathlib.Path(src).read_text(), extensions=['tables', 'sane_lists'])
logo = base64.b64encode(pathlib.Path('assets/brand/htm-logo.png').read_bytes()).decode()
css = """
@page { size: Letter; margin: 0.8in 0.75in 0.9in 0.75in; }
body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #0B2545; line-height: 1.38; }
h1 { font-size: 22pt; color: #0B2545; margin: 0 0 6pt; }
h2 { font-size: 14pt; color: #135BA6; border-bottom: 1.5px solid #135BA6; padding-bottom: 2pt; margin: 18pt 0 6pt; page-break-after: avoid; }
p { margin: 5pt 0; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; page-break-inside: avoid; }
th { background: #135BA6; color: #fff; text-align: left; padding: 4pt 6pt; }
td { border-bottom: 1px solid #d6dbe3; padding: 4pt 6pt; vertical-align: top; }
tr:nth-child(even) td { background: #F3F5F8; }
code { font-family: Menlo, monospace; font-size: 9pt; background: #F3F5F8; padding: 0 3px; }
a { color: #135BA6; text-decoration: none; }
hr { border: 0; border-top: 1px solid #d6dbe3; margin: 10pt 0; }
.logo { width: 3.4in; margin-bottom: 8pt; }
.footer { position: fixed; bottom: -0.55in; left: 0; right: 0; font-size: 8pt; color: #555F6B; }
"""
html = f"<!doctype html><meta charset='utf-8'><style>{css}</style><img class='logo' src='data:image/png;base64,{logo}'>{body}"
pathlib.Path(out).write_text(html)
EOF
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$PDF" "file://$PWD/$HTML" >/dev/null 2>&1
ls -la "$PDF"
