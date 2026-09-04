/**
 * Impound disbursement scheduling. Ada County, Idaho property tax is due in two
 * installments (Dec 20, Jun 20); hazard insurance renews annually. The scheduler
 * projects each impound sub-account against its next statutory deadline and says
 * whether an outbound push should be constructed. Pure function; no ledger calls.
 */
export interface Installment { due: string; description: string } // "MM-DD"

export interface ImpoundPlan {
  kind: 'tax' | 'insurance';
  payee: string;
  monthly_impound: number;
  annual_total: number;
  installments: Installment[];
}

export interface Milestone {
  kind: 'tax' | 'insurance';
  description: string;
  deadline: string;                 // ISO date
  days_remaining: number;
  amount_due: number;
  projected_balance_at_deadline: number;
  status: 'sufficient' | 'deficit';
  deficit: number;
  inside_execution_window: boolean; // <= 5 days out
  ready_to_disburse: boolean;       // inside window AND balance covers amount_due today
}

export const ADA_COUNTY_TAX_INSTALLMENTS: Installment[] = [
  { due: '12-20', description: 'First half property tax installment' },
  { due: '06-20', description: 'Second half property tax installment' },
];

function nextDeadline(mmdd: string, today: Date): Date {
  const [m, d] = mmdd.split('-').map(Number);
  let dl = new Date(Date.UTC(today.getUTCFullYear(), m - 1, d));
  if (dl < today) dl = new Date(Date.UTC(today.getUTCFullYear() + 1, m - 1, d));
  return dl;
}

export function evaluateImpound(plan: ImpoundPlan, currentBalance: number, today = new Date()): Milestone[] {
  const perInstallment = plan.annual_total / plan.installments.length;
  return plan.installments
    .map((inst) => {
      const dl = nextDeadline(inst.due, today);
      const days = Math.ceil((dl.getTime() - today.getTime()) / 86_400_000);
      const monthsRemaining = Math.ceil(days / 30.44);
      const projected = Math.round((currentBalance + plan.monthly_impound * monthsRemaining) * 100) / 100;
      const deficit = Math.max(0, Math.round((perInstallment - projected) * 100) / 100);
      const inWindow = days >= 0 && days <= 5;
      return {
        kind: plan.kind, description: inst.description, deadline: dl.toISOString().slice(0, 10), days_remaining: days,
        amount_due: perInstallment, projected_balance_at_deadline: projected,
        status: deficit === 0 ? 'sufficient' : 'deficit', deficit, inside_execution_window: inWindow,
        ready_to_disburse: inWindow && currentBalance >= perInstallment,
      } as Milestone;
    })
    .sort((a, b) => a.days_remaining - b.days_remaining);
}

/** Ripple-epoch FinishAfter for a native escrow that auto-releases the impound to the payee on the deadline. */
export function finishAfterForDeadline(deadlineIso: string): number {
  return Math.floor(Date.parse(deadlineIso + 'T17:00:00Z') / 1000) - 946_684_800;
}
