# Servicing automation extras (beyond grant scope)

The grant deliverable is: scan the close-of-escrow package → tokenize the note (MPT) → fund it through
XLS-65 / XLS-66 on Devnet. What happens *after* the homeowner's three-way payment reaches the lender
vault (investor distributions, sub-servicer fees, HOA the homeowner pays directly) is downstream of the
closing documents and is not modeled.

These files are the optional servicing-automation sketches from the brief, kept runnable:

- `tax_vault_scheduler.py` — projects the Tax Impound balance against Ada County's Dec 20 / Jun 20 deadlines (Python twin of `src/servicing/impound-scheduler.ts`).
- `xrpl_tax_disbursement.py` — xrpl-py `Payment` builder that pushes an impound balance to the treasurer node with an APN memo (dry-run unless `--send`).
- `dashboard.py` — FastAPI page reading `out/export/xls65_compliance.json` (produced by `npm run export`).

```bash
python3 -m venv /Volumes/BackupPlus/venvs/xrpl-mortgage && source /Volumes/BackupPlus/venvs/xrpl-mortgage/bin/activate
pip install xrpl-py fastapi uvicorn
python extras/servicing-automation/tax_vault_scheduler.py 1425
python extras/servicing-automation/dashboard.py   # http://127.0.0.1:8000
```
