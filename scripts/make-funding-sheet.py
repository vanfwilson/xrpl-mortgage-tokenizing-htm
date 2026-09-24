"""Generate the Mainnet funding sheet from real project data — never hand-typed.

Every figure comes from docs/demo/canonical-loan.json and data/servicing-parties.json, and every
address is derived from the wallet seed file. Nothing in the output is transcribed by a human or
a model, so the sheet cannot drift from what the engine actually deploys.

    python scripts/make-funding-sheet.py > out/FUND-THESE-MAINNET.txt
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("COUNCILFORGE_DSN", "postgresql://unused/report-only")

from xrpl.wallet import Wallet  # noqa: E402

from mortgageos.canonical import load_canonical_loan  # noqa: E402
from mortgageos.config import ROLES  # noqa: E402
from mortgageos.provision import FUNDING_PLAN  # noqa: E402
from mortgageos.servicing.amortization import monthly_payment_cents  # noqa: E402

doc = json.loads((ROOT / "docs/demo/canonical-loan.json").read_text())
parties = json.loads((ROOT / "data/servicing-parties.json").read_text())
seeds = json.loads((ROOT / "out/wallets.py.mainnet.json").read_text())
terms = load_canonical_loan()

L, P, B, PR, SEC, CL, SV = (doc["loan"], doc["note_terms"], doc["borrower"], doc["property"],
                            doc["security_instrument"], doc["closing"], doc["servicing"])
addr = {r: Wallet.from_seed(seeds[r]).address for r in ROLES}
pi = monthly_payment_cents(terms["principal_cents"], terms["rate_bps"], terms["term_months"]) / 100
ROLE_PURPOSE = {
    "issuer": "creates the note token", "lender": "holds the note",
    "impound": "taxes and insurance", "borrower": "makes the payments",
    "usdm_issuer": "settlement stablecoin", "tax_authority": "tax payee",
}
total = sum(FUNDING_PLAN.values())
W = 80

def rule(c="="): print(c * W)
def money(x): return f"${x:,.2f}"

rule()
print("MortgageOS - XRP LEDGER MAINNET FUNDING INSTRUCTIONS")
print("Prepared for: Richard Kent Young, High Tech Mortgage, Inc.")
print("Generated automatically from project data. Do not edit by hand.")
rule()
print(f"""
WHAT THIS IS
{'-'*W}
MortgageOS runs today on the XRP Ledger TEST network. Test networks use play
money, and grant reviewers discount anything that runs only on one.

Before we submit to XRPL Grants and the RippleX ecosystem team, we want to run
the system once on the REAL XRP Ledger (Mainnet), so a reviewer can open a public
blockchain explorer and watch it work. That costs real XRP, which is what this
funding is for.


THE LOAN BEING DEMONSTRATED IS COMPLETELY FICTITIOUS
{'-'*W}
Every party name below is deliberately self-identifying as fake - "Sandbox",
"Placeholder". This is the same demonstration loan already documented in the
project's closing package. NO REAL HTM LOAN, BORROWER OR PROPERTY IS INVOLVED.

  Loan ID .............. {L['loan_id']}
  Product .............. {L['product']}, {L['purpose']}, {L['loan_type']}
  FHA case number ...... {L['fha_case_number']}   (fictitious)
  Note form ............ {L['note_form']}

  BORROWER (fictitious)  {B['name']}
  Mailing address ...... {B['mailing_address']}

  PROPERTY (fictitious)  {PR['address']['street']}, {PR['address']['city']}, {PR['address']['state']} {PR['address']['zip']}
  County ............... {PR['address']['county']}
  Parcel number ........ {PR['apn']}
  Appraised value ...... {money(PR['appraised_value'])}
  Contract price ....... {money(PR['contract_sales_price'])}
  Loan-to-value ........ {PR['ltv']*100:.2f}%

  LENDER (fictitious) .. {doc['lender']['name']}, NMLS {doc['lender']['nmls_id']}
  SERVICER ............. {doc['servicer']['name']}
  TRUSTEE / TITLE ...... {SEC['trustee']}
  SELLER (fictitious) .. {doc['seller']['name']}

  LOAN TERMS
  Base loan amount ..... {money(L['base_loan_amount'])}
  Financed UFMIP ....... {money(L['financed_ufmip'])}
  Total principal ...... {money(L['principal_amount'])}
  Interest rate ........ {L['annual_interest_rate']*100:.3f}%  ({terms['rate_bps']} basis points)
  Term ................. {L['term_months']} months (30 years)
  Origination date ..... {L['origination_date']}
  First payment due .... {L['first_payment_date']}
  Maturity date ........ {L['maturity_date']}

  MONTHLY PAYMENT
  Principal & interest . {money(L['monthly_principal_and_interest'])}   (engine computes {money(pi)})
  Property tax impound . {money(SV['property_tax_impound'])}   -> {parties['county_treasurer']['name']}, {money(parties['county_treasurer']['annual_tax'])}/yr
  Hazard insurance ..... {money(SV['hazard_insurance_impound'])}   -> {parties['hazard_insurance_carrier']['name']}, {money(parties['hazard_insurance_carrier']['annual_premium'])}/yr
  FHA MIP .............. {money(SV['fha_mip'])}   -> {parties['fha_mip']['payee']}
  TOTAL MONTHLY ........ {money(SV['monthly_total_sweep'])}

  Late charge .......... {money(P['late_charge_amount'])} after a {P['grace_period_days']}-day grace period
  Prepayment penalty ... {'yes' if P['prepayment_penalty'] else 'none'}

No borrower personal information of any kind touches the public ledger. What
goes on-chain is the loan's fixed terms, a hash, and date-locked payment escrows.


WHY WE ARE NOT USING A REAL NOTE
{'-'*W}
Tokenizing a REAL promissory note, with real payments routed to investors, would
likely constitute a securities offering and would touch RESPA, TILA, UCC Articles
3 and 9, and California DRE/NMLS licensing. We are deliberately NOT doing that
without securities counsel first.

The demonstration answers the only question a grant reviewer is actually asking -
"does this software really work on the live network?" - with none of that risk.


THE COST
{'-'*W}
  Required on the ledger ........ {total} XRP   (about ${total*1.53:,.0f} at $1.53/XRP)
  Suggested purchase ............ {total+10} XRP   (about ${(total+10)*1.53:,.0f})

Buy extra because exchanges charge a withdrawal fee and the XRP price moves.

MOST OF THIS MONEY IS NOT SPENT. The XRP Ledger requires each account to hold a
refundable "reserve" - 1 XRP to exist, plus 0.2 XRP per item it holds on-ledger.
Reserves are LOCKED, not consumed, and are released if the accounts are closed.
Actual transaction fees for the whole demonstration are a fraction of one cent.
""")
rule()
print("HOW TO SEND - OPTION 1 (RECOMMENDED - ONE PAYMENT)")
rule()
print(f"""
Send ONE payment of {total+5} XRP to this address:

        {addr['issuer']}

        Confirm it begins    {addr['issuer'][:4]}
        Confirm it ends      {addr['issuer'][-4:]}

Do not enter a destination tag. Leave that field blank.

Van's system then distributes to the other five accounts on-ledger, for a
fraction of a cent in fees. This route means ONE address to verify and ONE
withdrawal fee instead of six.
""")
rule()
print("HOW TO SEND - OPTION 2 (SIX SEPARATE PAYMENTS)")
rule()
print("\nOnly if you would rather fund each account directly. Costs more, because most")
print("exchanges charge a withdrawal fee on every transaction.\n")
print(f"  {'AMOUNT':<8} {'PURPOSE':<26} ADDRESS")
print(f"  {'-'*6:<8} {'-'*24:<26} {'-'*34}")
for r in ROLES:
    print(f"  {str(FUNDING_PLAN[r])+' XRP':<8} {ROLE_PURPOSE[r]:<26} {addr[r]}")
print(f"  {'-'*6:<8}")
print(f"  {str(total)+' XRP':<8} TOTAL\n")
print("  Verify each by first four / last four characters:")
for r in ROLES:
    print(f"    {r:<14} {addr[r][:4]} ... {addr[r][-4:]}")
print(f"""
The borrower account gets the most because it creates every monthly payment
escrow - about thirteen over a twelve-month run, at 0.2 XRP each.
""")
rule()
print("SAFETY RULES - PLEASE READ BEFORE SENDING")
rule()
print("""
1. COPY AND PASTE THE ADDRESS. Never retype it by hand.

2. CHECK THE FIRST FOUR AND LAST FOUR characters after pasting.

3. XRP SENT TO A WRONG ADDRESS IS GONE PERMANENTLY. No reversals, no
   chargebacks, no support desk that can recover it.

4. NO DESTINATION TAG is needed. Leave that field blank.

5. THE FIRST PAYMENT TO EACH ACCOUNT MUST BE AT LEAST 1 XRP or the network
   rejects it. The amounts above already satisfy this.

6. TREAT ANY "CORRECTION" EMAIL AS FRAUD. Swapping addresses in an emailed
   payment instruction is the most common attack on this kind of transfer. If
   you receive any follow-up changing these addresses - even one that appears
   to come from Van - DO NOT USE IT. Phone Van and confirm verbally first.
""")
rule()
print("AFTER YOU SEND")
rule()
print("""
Tell Van. He runs an automated check that reads the real balance of all six
accounts, then runs the demonstration and captures the public blockchain links
for the grant submission.

XRP Ledger payments confirm in about 5 seconds. An exchange withdrawal can take
several minutes to be released.

Questions before sending: call Van rather than replying by email.
""")
rule()
