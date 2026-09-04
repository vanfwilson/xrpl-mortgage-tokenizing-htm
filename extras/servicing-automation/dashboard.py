#!/usr/bin/env python3
"""Beta-test operational dashboard: reads out/export/xls65_compliance.json and shows the loan,
registry and the three servicing buckets.   pip install fastapi uvicorn   ->   python dashboard.py"""
import json, os
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse

HERE = os.path.dirname(os.path.abspath(__file__))
METADATA = os.environ.get("XLS65_JSON", os.path.join(HERE, "..", "..", "out", "export", "xls65_compliance.json"))
app = FastAPI(title="HTM Mortgage Tokenization - Beta Dashboard")

@app.get("/api/dashboard/metrics")
def metrics():
    if not os.path.exists(METADATA):
        raise HTTPException(404, f"{METADATA} missing; run `npm run export` first")
    r = json.load(open(METADATA))["XLS-65-Metadata"]
    t, reg, lt, es, cp = r["token_identifiers"], r["registry_records"], r["loan_terms_fannie_mae_3200"], r["escrow_servicing_allocations_cd_p1"], r["counterparty_identity_mappings"]
    d = es["disbursement_rules"]
    return {
        "asset_symbol": t["asset_symbol"], "loan_number": t["loan_number"], "docs_sha256": t["underlying_document_bundle_sha256"],
        "apn": reg["assessor_parcel_number"], "jurisdiction": reg["recording_jurisdiction"], "document_number": reg["county_document_number"],
        "principal_amount": lt["principal_amount_usd"], "interest_rate": lt["annual_interest_rate"], "term_months": lt["term_months"],
        "monthly_sweep": es["monthly_total_borrower_sweep"], "pi_allocation": d["principal_and_interest_usd"],
        "tax_allocation": d["monthly_property_tax_impound_usd"], "insurance_allocation": d["monthly_hazard_insurance_impound_usd"],
        "tax_vault_wallet": cp["tax_impound_vault_wallet"], "insurance_vault_wallet": cp["insurance_impound_vault_wallet"],
        "lender_wallet": cp["lender_lienholder_wallet"], "county_wallet": cp["county_treasurer_wallet"],
    }

@app.get("/", response_class=HTMLResponse)
def view():
    return """<!doctype html><html><head><title>HTM Tokenization Dashboard</title>
<style>body{font-family:sans-serif;background:#0F172A;color:#E2E8F0;margin:0;padding:30px}.card{background:#1E293B;border-radius:8px;padding:24px;max-width:960px;margin:0 auto}
h2{border-bottom:1px solid #334155;padding-bottom:10px;color:#38BDF8;margin-top:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.m{background:#0F172A;padding:14px;border-radius:6px;border:1px solid #334155}.l{font-size:.7rem;text-transform:uppercase;color:#94A3B8;font-weight:bold}
.v{font-size:1.15rem;font-weight:bold;margin-top:4px;color:#F1F5F9;word-break:break-all}.w{font-family:monospace;font-size:.85rem;color:#34D399}.span{grid-column:span 3}</style></head>
<body><div class="card"><h2>HTM Mortgage Note Tokenization - Beta Monitor (Devnet)</h2><div class="grid" id="g"><div class="m"><div class="l">Loading...</div></div></div></div>
<script>const usd=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2});
fetch('/api/dashboard/metrics').then(r=>r.json()).then(d=>{g.innerHTML=`
<div class="m"><div class="l">Token</div><div class="v">${d.asset_symbol} / ${d.loan_number}</div></div>
<div class="m"><div class="l">Note principal</div><div class="v">${usd(d.principal_amount)}</div></div>
<div class="m"><div class="l">Rate / term</div><div class="v">${(d.interest_rate*100).toFixed(3)}% / ${d.term_months} mo</div></div>
<div class="m"><div class="l">Monthly sweep</div><div class="v">${usd(d.monthly_sweep)}</div></div>
<div class="m"><div class="l">P&amp;I to lender vault</div><div class="v">${usd(d.pi_allocation)}</div></div>
<div class="m"><div class="l">Tax impound / Insurance impound</div><div class="v">${usd(d.tax_allocation)} / ${usd(d.insurance_allocation)}</div></div>
<div class="m"><div class="l">APN</div><div class="v">${d.apn}</div></div>
<div class="m"><div class="l">Recording</div><div class="v">${d.document_number}</div></div>
<div class="m"><div class="l">Jurisdiction</div><div class="v" style="font-size:.9rem">${d.jurisdiction}</div></div>
<div class="m span"><div class="l">Document bundle sha256</div><div class="v w">${d.docs_sha256}</div></div>
<div class="m span"><div class="l">Tax impound wallet -> county treasurer</div><div class="v w">${d.tax_vault_wallet} -> ${d.county_wallet}</div></div>
<div class="m span"><div class="l">Insurance impound wallet</div><div class="v w">${d.insurance_vault_wallet}</div></div>`}).catch(e=>{g.innerHTML='<div class="m span" style="color:#EF4444">Run `npm run export` to create out/export/xls65_compliance.json</div>'})</script></body></html>"""

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
