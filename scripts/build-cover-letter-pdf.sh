#!/usr/bin/env bash
# Render docs/grant-cover-letter-2026-09-17.md to docs/grant-cover-letter-2026-09-17.pdf.
# Same header/logo treatment and CSS as build-grant-pdf.sh, one page, signature-ready.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=docs/grant-cover-letter-2026-09-17.md
HTML=out/grant-cover-letter-2026-09-17.html
PDF=docs/grant-cover-letter-2026-09-17.pdf
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
GRANT_PYTHON="${GRANT_PYTHON:-python3}"
mkdir -p out
"$GRANT_PYTHON" - "$SRC" "$HTML" <<'EOF'
import sys, markdown, base64, pathlib, re
src, out = sys.argv[1], sys.argv[2]
text = pathlib.Path(src).read_text()
# Drop the leading internal status blockquote (lines starting with ">") before rendering.
lines = text.splitlines()
i = 0
while i < len(lines) and (lines[i].startswith('>') or lines[i].strip() == ''):
    i += 1
text = '\n'.join(lines[i:])
body = markdown.markdown(text, extensions=['tables', 'sane_lists'])
def _b64(path):
    return base64.b64encode(pathlib.Path(path).read_bytes()).decode()
htm_logo = _b64('assets/brand/htm-logo.png')
grc_logo = _b64('assets/brand/grc-logo-circle.png')
nar_logo = _b64('assets/brand/grc-nar.jpeg')
prc_logo = _b64('assets/brand/grc-prc.jpeg')
css = """
@page { size: Letter; margin: 0.65in 0.75in 0.6in 0.75in; }
body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #0B2545; line-height: 1.32; }
h1 { font-size: 15pt; color: #0B2545; margin: 2pt 0 4pt; }
p { margin: 6pt 0; }
a { color: #135BA6; text-decoration: none; }
strong { font-weight: 700; }
ol, ul { margin: 4pt 0; padding-left: 18pt; }
li { margin: 2pt 0; }
.brand-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8pt; margin: 0 0 10pt; }
.htm-brand { flex: 1 1 auto; }
.htm-logo { width: 2.9in; display: block; }
.jv-connector { width: 1.05in; flex: none; margin-top: 18pt; text-align: center; color: #135BA6; }
.jv-label { font-size: 8.5pt; font-weight: 700; white-space: nowrap; margin-bottom: 2pt; }
.jv-arrow { display: flex; align-items: center; width: 100%; font-size: 7pt; line-height: 1; }
.jv-arrow-line { height: 1.5px; background: #135BA6; flex: 1; }
.grc-block { width: 2.35in; margin-left: auto; text-align: right; }
.grc-brand { width: 2.35in; margin-left: auto; display: flex; justify-content: flex-end; align-items: center; gap: 7pt; }
.grc-logo { width: 0.9in; height: 0.9in; object-fit: contain; display: block; }
.grc-credential { width: 0.5in; height: 0.5in; object-fit: contain; display: block; }
.grc-site { font-size: 8.5pt; color: #135BA6; margin-top: 3pt; }
.site { font-size: 10.5pt; color: #135BA6; margin: 0 0 6pt; }
.signspace { height: 16pt; margin: 0; }
.sig { margin-top: 2pt; line-height: 1.3; page-break-inside: avoid; }
"""
header = f"""<div class='brand-header'>
<div class='htm-brand'><img class='htm-logo' src='data:image/png;base64,{htm_logo}'><div class='site'>hightechmortgage.com</div></div>
<div class='jv-connector'><div class='jv-label'>Joint-Venture</div><div class='jv-arrow'><span>◀</span><span class='jv-arrow-line'></span><span>▶</span></div></div>
<div class='grc-block'><div class='grc-brand'><img class='grc-logo' src='data:image/png;base64,{grc_logo}' alt='Global Realtor 4A Cause'><img class='grc-credential' src='data:image/jpeg;base64,{nar_logo}' alt='National Association of Realtors'><img class='grc-credential' src='data:image/jpeg;base64,{prc_logo}' alt='Professional Regulation Commission of the Philippines'></div><div class='grc-site'>globalrealtor4acause.com</div></div>
</div>"""
html = f"<!doctype html><meta charset='utf-8'><style>{css}</style>{header}{body}"
pathlib.Path(out).write_text(html)
EOF
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$PDF" "file://$PWD/$HTML" >/dev/null 2>&1
ls -la "$PDF"
