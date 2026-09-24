"""Single source of truth for the demonstration loan.

`docs/demo/canonical-loan.json` is the closing package the whole project shows reviewers — the
Note, the Deed of Trust, the Closing Disclosure and the statements are all generated against it.
Until v4 the engine kept its own hand-copied constants, which silently drifted: the rate, the tax
impound and the hazard premium all disagreed with the closing package, so the escrow amounts the
engine settled did not match the documents a reviewer would read beside them.

On a public Mainnet ledger that inconsistency would be permanent, so the constants are now derived
from the JSON and cross-checked against it on import.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANONICAL_LOAN_FILE = ROOT / "docs" / "demo" / "canonical-loan.json"
SERVICING_PARTIES_FILE = ROOT / "data" / "servicing-parties.json"


def _cents(dollars: float) -> int:
    return int(round(dollars * 100))


def load_canonical_loan() -> dict:
    """Engine kwargs for phase1, derived from the closing package.

    Raises ValueError if the closing package is internally inconsistent — a wrong number here
    would be written to an immutable ledger.
    """
    doc = json.loads(CANONICAL_LOAN_FILE.read_text())
    loan, servicing = doc["loan"], doc["servicing"]

    terms = {
        "principal_cents": _cents(loan["principal_amount"]),
        "rate_bps": int(round(loan["annual_interest_rate"] * 10_000)),
        "term_months": int(loan["term_months"]),
        "annual_tax_cents": _cents(servicing["property_tax_impound"] * 12),
        "annual_ins_cents": _cents(servicing["hazard_insurance_impound"] * 12),
    }

    # The stated P&I on the Note must equal what the amortization engine computes, or the ledger
    # would settle a different payment than the document says is owed.
    from .servicing.amortization import monthly_payment_cents
    computed = monthly_payment_cents(terms["principal_cents"], terms["rate_bps"], terms["term_months"])
    stated = _cents(loan["monthly_principal_and_interest"])
    if computed != stated:
        raise ValueError(
            f"canonical-loan.json P&I disagrees with the amortization engine: "
            f"document says {stated} cents, engine computes {computed} cents"
        )

    # The impounds must also match the payee schedules they are collected against.
    parties = json.loads(SERVICING_PARTIES_FILE.read_text())
    for label, got, want in (
        ("property tax", terms["annual_tax_cents"], _cents(parties["county_treasurer"]["annual_tax"])),
        ("hazard insurance", terms["annual_ins_cents"], _cents(parties["hazard_insurance_carrier"]["annual_premium"])),
    ):
        if got != want:
            raise ValueError(
                f"{label} impound disagrees with servicing-parties.json: "
                f"loan implies {got} cents/yr, payee schedule says {want} cents/yr"
            )
    return terms
