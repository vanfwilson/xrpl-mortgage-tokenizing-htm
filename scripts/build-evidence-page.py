#!/usr/bin/env python3
"""Render docs/evidence/v3/index.html from the committed evidence JSON (verify run + automated Xahau proof).

Static, self-contained, served by GitHub Pages from main:/docs. Run: python3 scripts/build-evidence-page.py
"""
from __future__ import annotations

import glob
import html
import json
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXPLORER = "https://testnet.xrpl.org"
OUT = ROOT / "docs/evidence/v3/index.html"


def latest(pattern: str) -> pathlib.Path | None:
    files = sorted(glob.glob(str(ROOT / pattern)), key=os.path.getmtime)
    return pathlib.Path(files[-1]) if files else None


def tx_link(h: str) -> str:
    return f'<a href="{EXPLORER}/transactions/{html.escape(h)}"><code>{html.escape(h[:12])}…</code></a>'


def money(cents: int) -> str:
    return f"${cents / 100:,.2f}"


ev_path = latest("docs/evidence/v3/run-*-note-asset.json")
hook_path = latest("hooks/evidence/xahau-testnet-proof-*.json")
ev = json.loads(ev_path.read_text())
hook = json.loads(hook_path.read_text()) if hook_path else None

p1, p2, p3, audit = ev["phase1"], ev["phase2"], ev["phase3"], ev["audit"]
note = p1["note_issuance"]
meta = note["metadata"]["ai"]
flags = int(note["flags"], 16)
flag_names = [(0x02, "CanLock"), (0x04, "RequireAuth"), (0x08, "CanEscrow"), (0x10, "CanTrade"), (0x20, "CanTransfer"), (0x40, "CanClawback")]

rows_flags = "".join(
    f"<tr><td>{n}</td><td class='{'on' if flags & b else 'off'}'>{'set' if flags & b else 'not set'}</td></tr>" for b, n in flag_names
)
rows_legs = "".join(
    f"<tr><td>{l['leg_id']}</td><td>{tx_link(l['finish_tx'])}</td><td>{html.escape(l['result'])}</td></tr>" for l in p2["legs"]
)
rows_states = "".join(f"<tr><td>{html.escape(k)}</td><td>{v}</td></tr>" for k, v in ev["tx_states"].items())
hook_rows = ""
if hook:
    hook_rows = "".join(
        f"<tr><td>{html.escape(s['label'])}</td><td>{html.escape(s['want'])}</td><td class='{'on' if s['pass'] else 'off'}'>{html.escape(s['result'])}</td>"
        f"<td><code>{html.escape((s['hash'] or '')[:12])}…</code></td><td>{html.escape(' | '.join(s.get('hookReturn') or []))}</td></tr>"
        for s in hook["steps"]
    )

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MortgageOS v3.1 — Testnet evidence</title>
<style>
body{{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:980px;margin:2rem auto;padding:0 1rem;color:#0B2545;line-height:1.45}}
h1{{font-size:1.6rem}} h2{{color:#135BA6;border-bottom:1.5px solid #135BA6;padding-bottom:.2rem;margin-top:2rem}}
table{{border-collapse:collapse;width:100%;margin:.6rem 0 1rem;font-size:.92rem}} th{{background:#135BA6;color:#fff;text-align:left;padding:.4rem .5rem}}
td{{border-bottom:1px solid #d6dbe3;padding:.35rem .5rem;vertical-align:top}} code{{font-family:Menlo,monospace;font-size:.85em;background:#F3F5F8;padding:0 3px}}
.on{{color:#1a7f37;font-weight:600}} .off{{color:#8a8f98}} .kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem;margin:1rem 0}}
.kpi div{{background:#F3F5F8;border-radius:6px;padding:.6rem .8rem}} .kpi b{{display:block;font-size:1.25rem}} .muted{{color:#555F6B;font-size:.9rem}}
</style></head><body>
<h1>MortgageOS™ v3.1 — XRP Ledger Testnet evidence</h1>
<p class="muted">Loan <code>{html.escape(ev['loan_id'])}</code> · network <code>{html.escape(ev['network'])}</code> · engine version {html.escape(ev.get('version','3.1.0'))} ·
source <code>{html.escape(ev_path.name)}</code> · exit contract: <code>{html.escape(ev['success_string'])}</code></p>
<div class="kpi">
<div><b>{money(audit['asset_face_value'])}</b>note face value on-ledger, unchanged</div>
<div><b>{money(audit['db_outstanding'])}</b>outstanding principal in the books</div>
<div><b>{audit['proofs_verified']} / {audit['proofs_total']}</b>payment proofs re-verified on-ledger</div>
<div><b>{money(p2['pi_cents'])}</b>fixed P&amp;I, identical every month</div>
</div>

<h2>1. The note asset</h2>
<p>One Multi-Purpose Token issuance is the digital twin of the fixed-rate note, held by the lending institution at face value.
Issuance <code>{html.escape(note['id'])}</code>, minted in {tx_link(note['tx'])}. Metadata: kind <code>{html.escape(meta['kind'])}</code>,
principal {money(meta['principal_cents'])}, rate {meta['rate_bps']/100:.3f} %, term {meta['term_months']} months, P&amp;I {money(meta['pi_cents'])},
terms sha256 <code>{html.escape(meta['sha256'][:16])}…</code>.</p>
<table><tr><th>Flag</th><th>State ({html.escape(note['flags'])})</th></tr>{rows_flags}</table>
<p class="muted">DepositAuth on issuer / lender / impound: {html.escape(json.dumps(p1['deposit_auth']))}. The lender holds {audit['chain_units']:,} units after the period settled — the asset is never burned as the loan amortizes.</p>

<h2>2. The payment rail (period {p2['period']})</h2>
<p>Fixed P&amp;I to the lender and the tax + insurance impound to the custodial account, each a TokenEscrow that could not be finished before the due date.
The validated <code>EscrowFinish</code> is the on-chain proof of payment; the audit sweep re-read each one from the ledger.</p>
<table><tr><th>Leg row</th><th>Finish transaction</th><th>Result</th></tr>{rows_legs}</table>

<h2>3. Error triage</h2>
<p>Forced ledger error: <code>{html.escape(p3['unfunded'])}</code> · forced network timeout: <code>{html.escape(p3['timeout'])}</code> · audit rows written: {p3['audit_rows']} (raw code + full envelope, engine exited cleanly).</p>

<h2>4. Ledger transactions this run</h2>
<table><tr><th>State</th><th>Count</th></tr>{rows_states}</table>
<p class="muted">The one Failed row is the deliberate Phase 3 unfunded payment. Zero Pending.</p>

<h2>5. Hook firewall (sidecar, Xahau Testnet)</h2>
{"<p class='muted'>No Xahau proof file committed.</p>" if not hook else f'''<p>The C payment-firewall Hook compiled to WASM (sha256 <code>{html.escape(hook.get("wasm_sha256","")[:16])}…</code>), installed on Xahau Testnet
(network id {hook["network_id"]}) at commit <code>{html.escape((hook.get("commit") or "")[:7])}</code>, {hook["ran_at"] if "ran_at" in hook else ""}. Not part of the core: Hooks are not enabled on the XRP Ledger.</p>
<table><tr><th>Step</th><th>Expected</th><th>Result</th><th>Tx</th><th>Hook return</th></tr>{hook_rows}</table>'''}

<p class="muted">Repository: <a href="https://github.com/vanfwilson/xrpl-mortgage-tokenizing-htm">github.com/vanfwilson/xrpl-mortgage-tokenizing-htm</a> ·
raw evidence JSON in this folder · rebuilt by <code>scripts/build-evidence-page.py</code>.</p>
</body></html>
"""
OUT.write_text(page)
print(f"wrote {OUT.relative_to(ROOT)} from {ev_path.name}" + (f" + {hook_path.name}" if hook_path else ""))
