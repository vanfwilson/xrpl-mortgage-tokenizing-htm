#!/usr/bin/env python3
"""Tax impound vault scheduler (Python twin of src/servicing/impound-scheduler.ts).
Projects the on-chain Tax Impound sub-account against Ada County's semi-annual
deadlines and flags the 5-day execution window. No network calls."""
import datetime, math, sys, json

class TaxVaultScheduler:
    def __init__(self, property_apn, monthly_tax_impound, annual_tax_total, target_county_vault):
        self.property_apn = property_apn
        self.monthly_tax_impound = float(monthly_tax_impound)
        self.annual_tax_total = float(annual_tax_total)
        self.target_county_vault = target_county_vault
        self.disbursement_schedule = [
            {"deadline": "12-20", "description": "First Half Property Tax Installment"},
            {"deadline": "06-20", "description": "Second Half Property Tax Installment"},
        ]

    def evaluate(self, current_vault_balance_usd, today=None):
        today = today or datetime.date.today()
        half = self.annual_tax_total / 2.0
        out = []
        for ev in self.disbursement_schedule:
            m, d = map(int, ev["deadline"].split("-"))
            dl = datetime.date(today.year, m, d)
            if dl < today:
                dl = datetime.date(today.year + 1, m, d)
            days = (dl - today).days
            months = math.ceil(days / 30.44)
            projected = current_vault_balance_usd + self.monthly_tax_impound * months
            out.append({
                "milestone": ev["description"], "deadline": dl.isoformat(), "days_remaining": days,
                "amount_due": round(half, 2), "projected_balance": round(projected, 2),
                "status": "sufficient" if projected >= half else "deficit",
                "deficit": round(max(0.0, half - projected), 2),
                "inside_execution_window": 0 <= days <= 5,
                "ready_to_disburse": 0 <= days <= 5 and current_vault_balance_usd >= half,
                "payee": self.target_county_vault,
            })
        return sorted(out, key=lambda r: r["days_remaining"])

if __name__ == "__main__":
    balance = float(sys.argv[1]) if len(sys.argv) > 1 else 1425.00
    s = TaxVaultScheduler("R993821-0014", 285.00, 285.00 * 12, "<COUNTY_TREASURER_ACCOUNT>")
    print(json.dumps(s.evaluate(balance), indent=2))
