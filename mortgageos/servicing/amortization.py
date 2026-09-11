from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def monthly_payment_cents(principal_cents: int, rate_bps: int, term_months: int) -> int:
    p = Decimal(principal_cents)
    if rate_bps == 0:
        return int((p / term_months).quantize(Decimal(1), ROUND_HALF_UP))
    r = Decimal(rate_bps) / Decimal(10000) / Decimal(12)
    f = (1 + r) ** term_months
    return int((p * r * f / (f - 1)).quantize(Decimal(1), ROUND_HALF_UP))


def schedule(principal_cents: int, rate_bps: int, term_months: int, first_due: date,
             annual_tax_cents: int = 0, annual_ins_cents: int = 0, periods: int | None = None) -> list[dict]:
    """Fixed-rate P&I schedule in exact cents; impound legs are the RESPA rolling 1/12 of last actual bills."""
    pmt = monthly_payment_cents(principal_cents, rate_bps, term_months)
    r = Decimal(rate_bps) / Decimal(10000) / Decimal(12)
    bal = principal_cents
    tax_m, ins_m = respa_monthly(annual_tax_cents), respa_monthly(annual_ins_cents)
    rows: list[dict] = []
    for i in range(1, (periods or term_months) + 1):
        interest = int((Decimal(bal) * r).quantize(Decimal(1), ROUND_HALF_UP))
        principal = min(pmt - interest, bal) if i < term_months else bal
        bal -= principal
        y, m = divmod(first_due.month - 1 + (i - 1), 12)
        rows.append({
            "period": i, "due_date": date(first_due.year + y, m + 1, min(first_due.day, 28)),
            "pi_cents": principal + interest, "principal_cents": principal, "interest_cents": interest,
            "tax_cents": tax_m, "ins_cents": ins_m,
        })
    return rows


def respa_monthly(annual_bill_cents: int) -> int:
    """12 CFR 1024.17: collect 1/12 of the last actual annual bill each month (rolling 12-month projection)."""
    return int((Decimal(annual_bill_cents) / 12).quantize(Decimal(1), ROUND_HALF_UP))


def respa_shortfall(projected_annual_cents: int, last_annual_cents: int) -> int:
    """If the new bill exceeds what 1/12 collections will cover, the servicer advances the difference now."""
    return max(projected_annual_cents - last_annual_cents, 0)
