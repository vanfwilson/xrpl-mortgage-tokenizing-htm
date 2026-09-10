import { addBusinessDays, addDays, daysBetween } from './calendar.js';
import { assertIsoDate, type Evidence } from './cases.js';
import type { IsoDate } from './types.js';

/**
 * R15 evidence-bearing loss-mitigation and early-intervention state machines.
 * 12 CFR 1024.39(a) live contact by day 36 and (b) written notice by day 45 of delinquency (a written notice
 * within the prior 180 days satisfies (b)); 12 CFR 1024.41(b)(2) acknowledgment and completeness notice within
 * 5 business days, (c)(1) evaluation of every available option within 30 days of a complete application received
 * more than 37 days before a sale, (e) 14-day (>= 90 days before sale) or 7-day acceptance window, (f)/(g)
 * foreclosure protections, (h) 14-day appeal with independent review and a 30-day appeal decision.
 *
 * This is the ordinary-path workflow, not an authorization to foreclose. Exemptions, facial completeness,
 * third-party delays and transferred applications route to `specialist_review`; they never silently select
 * this profile. Foreclosure action is always reported as blocked pending bank counsel review.
 */
export interface CaseScope { companyId: string; loanId: string; caseId: string }
export interface CaseEvidence extends CaseScope, Evidence {}

export type OptionDecision = { optionId: string; offered: boolean; reason: string };

export type MitigationEvent = CaseEvidence & (
  | { type: 'acknowledge'; missingDocuments: readonly string[]; reasonableCompletionDate?: IsoDate }
  | { type: 'complete'; borrowerDocumentsComplete: true }
  | { type: 'complete_notice' }
  | { type: 'decide'; reviewerId: string; decisions: readonly OptionDecision[] }
  | { type: 'appeal' }
  | { type: 'appeal_decision'; reviewerId: string; offeredOptionIds: readonly string[]; reason: string }
  | { type: 'accept'; optionId: string }
  | { type: 'reject' }
  | { type: 'plan_performing' }
  | { type: 'plan_failed' }
);
export type MitigationEventType = MitigationEvent['type'];

export type MitigationProfile = 'ordinary' | 'specialist_review';
export type MitigationStatus = 'received' | 'awaiting_documents' | 'acknowledged' | 'complete' | 'evaluating' | 'decision_delivered' | 'appeal_pending' | 'appeal_decided' | 'plan_accepted' | 'borrower_rejected' | 'plan_performing' | 'plan_failed' | 'specialist_review';
export type MitigationTaskKind = 'acknowledge' | 'complete_notice' | 'decision_notice' | 'appeal_notice';
export interface MitigationTask { kind: MitigationTaskKind; dueOn: IsoDate; completedOn?: IsoDate; overdue: boolean }

export interface MitigationInput extends CaseScope {
  receivedOn: IsoDate;
  asOf: IsoDate;
  /** Scheduled sale date when the application arrived; < 45 days lead waives the acknowledgment (1024.41(b)(2)(i)). */
  saleDateAtReceipt?: IsoDate;
  /** Scheduled sale date when the application became complete; <= 37 days lead waives the evaluation duty (1024.41(c)(1)). */
  saleDateAtCompletion?: IsoDate;
  /** True when no first notice or filing has been made, which keeps the appeal right open (1024.41(h)(1)). */
  beforeFirstForeclosureNotice: boolean;
  profile: MitigationProfile;
  /** The bank's option catalog; every option must be evaluated with a reason (1024.41(c)(1)(i), (d)). */
  availableOptions: readonly { id: string; modification: boolean }[];
  events: readonly MitigationEvent[];
}

export interface MitigationResult {
  status: MitigationStatus;
  completeOn?: IsoDate;
  offeredOptionIds: readonly string[];
  appealDeadline?: IsoDate;
  responseDeadline?: IsoDate;
  tasks: MitigationTask[];
  foreclosureAction: 'blocked_pending_bank_counsel_review';
  events: MitigationEvent[];
  cite: string;
}

/** Replay immutable evidence; returns overdue tasks instead of discarding late records. */
export function lossMitigationCase(input: MitigationInput): MitigationResult {
  assertIsoDate(input.receivedOn, 'receivedOn'); assertIsoDate(input.asOf, 'asOf');
  if (!input.companyId || !input.loanId || !input.caseId) throw new Error('invalid case scope: companyId, loanId and caseId required');
  if (input.asOf < input.receivedOn) throw new Error('invalid case date: asOf precedes receivedOn');
  if (input.saleDateAtReceipt) assertIsoDate(input.saleDateAtReceipt, 'saleDateAtReceipt');
  if (input.saleDateAtCompletion) assertIsoDate(input.saleDateAtCompletion, 'saleDateAtCompletion');
  const options = input.availableOptions.map((o) => o.id);
  if (!options.length || options.some((x) => !x) || new Set(options).size !== options.length) throw new Error('unique bank option catalog required');
  const cite = '12 CFR 1024.41(b)(2), (c)(1), (d), (e), (f), (g), (h)';

  const receiptLead = input.saleDateAtReceipt ? daysBetween(input.receivedOn, input.saleDateAtReceipt) : Infinity;
  const tasks: Array<Omit<MitigationTask, 'overdue'>> = [];
  if (receiptLead >= 45) tasks.push({ kind: 'acknowledge', dueOn: addBusinessDays(input.receivedOn, 5) });
  let status: MitigationStatus = 'received', lastOn = input.receivedOn, completeOn: IsoDate | undefined;
  let completeLead = Infinity, reviewer: string | undefined, offered: readonly string[] = [];
  let appealDeadline: IsoDate | undefined, responseDeadline: IsoDate | undefined;
  let canAppeal = false;
  const evidence = new Set<string>();
  const finish = (kind: MitigationTaskKind, on: IsoDate) => { const task = tasks.find((t) => t.kind === kind && !t.completedOn); if (task) task.completedOn = on; };

  for (const event of input.events) {
    assertIsoDate(event.on, `${event.type}.on`);
    if (event.companyId !== input.companyId || event.loanId !== input.loanId || event.caseId !== input.caseId) throw new Error('case scope mismatch: event belongs to another tenant/loan/case');
    if (!event.evidenceId || evidence.has(event.evidenceId)) throw new Error('duplicate evidence or missing evidenceId');
    if (event.on < lastOn || event.on > input.asOf) throw new Error('invalid event chronology: events must be ordered and not after asOf');
    evidence.add(event.evidenceId); lastOn = event.on;
    switch (event.type) {
      case 'acknowledge':
        if (status !== 'received') throw new Error('acknowledgment transition invalid');
        if (event.missingDocuments.length) {
          if (!event.reasonableCompletionDate) throw new Error('reasonable completion date required with missing documents (1024.41(b)(2)(i)(B))');
          assertIsoDate(event.reasonableCompletionDate, 'reasonableCompletionDate');
          if (daysBetween(event.on, event.reasonableCompletionDate) <= 0) throw new Error('reasonable completion date required after the acknowledgment');
          status = 'awaiting_documents';
        } else status = 'acknowledged';
        finish('acknowledge', event.on); break;
      case 'complete':
        if (!(status === 'received' || status === 'awaiting_documents' || status === 'acknowledged') || !event.borrowerDocumentsComplete) throw new Error('completeness transition invalid');
        completeOn = event.on;
        completeLead = input.saleDateAtCompletion ? daysBetween(completeOn, input.saleDateAtCompletion) : Infinity;
        status = 'complete';
        if (completeLead > 37) {
          tasks.push({ kind: 'complete_notice', dueOn: addBusinessDays(completeOn, 5) });
          tasks.push({ kind: 'decision_notice', dueOn: addDays(completeOn, 30) });
        }
        break;
      case 'complete_notice':
        if (status !== 'complete') throw new Error('complete notice transition invalid');
        finish('complete_notice', event.on); finish('acknowledge', event.on); status = 'evaluating'; break;
      case 'decide': {
        if (!(status === 'complete' || status === 'evaluating') || !event.reviewerId) throw new Error('evaluation transition invalid');
        const ids = event.decisions.map((d) => d.optionId);
        if (ids.length !== options.length || new Set(ids).size !== ids.length || options.some((id) => !ids.includes(id)) || event.decisions.some((d) => !d.reason.trim())) throw new Error('evaluate every available option with reasons (1024.41(c)(1)(i), (d))');
        reviewer = event.reviewerId;
        offered = event.decisions.filter((d) => d.offered).map((d) => d.optionId);
        const deniedModification = event.decisions.some((d) => !d.offered && input.availableOptions.find((o) => o.id === d.optionId)?.modification === true);
        canAppeal = (completeLead >= 90 || input.beforeFirstForeclosureNotice) && deniedModification;
        appealDeadline = canAppeal ? addDays(event.on, 14) : undefined;
        responseDeadline = addDays(event.on, completeLead >= 90 ? 14 : 7);
        finish('decision_notice', event.on); finish('complete_notice', event.on);
        status = 'decision_delivered'; break;
      }
      case 'appeal':
        if (status !== 'decision_delivered' || !canAppeal || !appealDeadline) throw new Error('appeal unavailable: only denied modification options within 1024.41(h)(1) may be appealed');
        if (event.on > appealDeadline) throw new Error('appeal late: 14 days after the decision notice (1024.41(h)(2))');
        status = 'appeal_pending'; tasks.push({ kind: 'appeal_notice', dueOn: addDays(event.on, 30) }); break;
      case 'appeal_decision':
        if (status !== 'appeal_pending' || !event.reviewerId || event.reviewerId === reviewer || !event.reason.trim() || event.offeredOptionIds.some((id) => !options.includes(id))) throw new Error('independent appeal review required (1024.41(h)(3))');
        // Previously offered options remain available through the appeal response period.
        offered = [...new Set([...offered, ...event.offeredOptionIds])];
        finish('appeal_notice', event.on); responseDeadline = addDays(event.on, 14); status = 'appeal_decided'; break;
      case 'accept':
        if (!(status === 'decision_delivered' || status === 'appeal_decided') || !offered.includes(event.optionId) || !responseDeadline || event.on > responseDeadline) throw new Error('offer acceptance invalid; route late acceptance to review (1024.41(e))');
        status = 'plan_accepted'; break;
      case 'reject':
        if (!(status === 'decision_delivered' || status === 'appeal_decided')) throw new Error('rejection transition invalid');
        status = 'borrower_rejected'; break;
      case 'plan_performing':
      case 'plan_failed':
        if (!(status === 'plan_accepted' || status === 'plan_performing')) throw new Error('plan transition invalid');
        status = event.type; break;
    }
  }
  return {
    status: input.profile === 'specialist_review' ? 'specialist_review' : status,
    completeOn, offeredOptionIds: offered, appealDeadline, responseDeadline,
    tasks: tasks.map((t) => ({ ...t, overdue: (t.completedOn ?? input.asOf) > t.dueOn })),
    foreclosureAction: 'blocked_pending_bank_counsel_review',
    events: input.events.map((e) => ({ ...e })),
    cite,
  };
}

export interface EarlyInterventionInput {
  missedDueDates: readonly IsoDate[];
  asOf: IsoDate;
  contacts: readonly Evidence[];
  writtenNotices: readonly Evidence[];
  profile: MitigationProfile;
}
export interface EarlyInterventionTask { due: IsoDate; contactDue: IsoDate; writtenDue: IsoDate; contactOverdue: boolean; writtenOverdue: boolean }

/**
 * R15 12 CFR 1024.39: repeat contact deadlines for each missed monthly due date, ordinary profile.
 * (a) good-faith live contact by the 36th day of delinquency, repeated for each payment cycle; (b) written notice
 * by the 45th day, but a notice sent within the prior 180 days satisfies the duty. Notice content and actual
 * delivery remain recorded bank evidence; this only tracks deadlines against that evidence.
 */
export function earlyIntervention(input: EarlyInterventionInput): { status: 'tracking' | 'specialist_review'; tasks: EarlyInterventionTask[]; cite: string } {
  assertIsoDate(input.asOf, 'asOf');
  const validate = (label: string) => (e: Evidence) => { assertIsoDate(e.on, label); if (!e.evidenceId || e.on > input.asOf) throw new Error(`${label}: invalid intervention evidence`); };
  input.contacts.forEach(validate('contact')); input.writtenNotices.forEach(validate('writtenNotice'));
  const dues = [...new Set(input.missedDueDates)].sort();
  const tasks = dues.map((due) => {
    assertIsoDate(due, 'missedDueDate'); if (due > input.asOf) throw new Error('future missed payment');
    const contactDue = addDays(due, 36), writtenDue = addDays(due, 45);
    const contact = input.contacts.find((e) => e.on >= due && e.on <= contactDue);
    // Once in a 180-day period is sufficient; retain the first day-45 deadline.
    const written = input.writtenNotices.find((e) => e.on >= addDays(writtenDue, -180) && e.on <= writtenDue && e.on >= dues[0]);
    return { due, contactDue, writtenDue, contactOverdue: input.asOf > contactDue && !contact, writtenOverdue: input.asOf > writtenDue && !written };
  });
  return { status: input.profile === 'specialist_review' ? 'specialist_review' : 'tracking', tasks, cite: '12 CFR 1024.39(a), (b)' };
}
