import { addBusinessDays, addDays, parseDay } from './dates.js';

/** R15: ordinary-path workflow, not an authorization to foreclose.
 * Sources accessed 2026-09-10: CFPB 1024.39(a),(b), 1024.41(b),(c),(e),(h).
 * Exemptions, facial completeness, third-party delays and transferred cases
 * require specialist routing; they must not silently select this profile. */
export interface CaseScope { companyId: string; loanId: string; caseId: string }
export interface CaseEvidence extends CaseScope { on: string; evidenceId: string }
export type MitigationEvent = CaseEvidence & (
  | { type: 'acknowledge'; missingDocuments: readonly string[]; reasonableCompletionDate?: string }
  | { type: 'complete'; borrowerDocumentsComplete: true }
  | { type: 'complete_notice' }
  | { type: 'decide'; reviewerId: string; decisions: readonly { optionId: string; offered: boolean; reason: string }[] }
  | { type: 'appeal' }
  | { type: 'appeal_decision'; reviewerId: string; offeredOptionIds: readonly string[]; reason: string }
  | { type: 'accept'; optionId: string }
  | { type: 'reject' }
  | { type: 'plan_performing' | 'plan_failed' }
);
export interface MitigationInput extends CaseScope {
  receivedOn: string; asOf: string; saleDateAtReceipt?: string;
  saleDateAtCompletion?: string; beforeFirstForeclosureNotice: boolean;
  profile: 'ordinary' | 'specialist_review';
  availableOptions: readonly { id: string; modification: boolean }[];
  publicHolidays: readonly string[]; events: readonly MitigationEvent[];
}
const days = (a: string, b: string) => (parseDay(b) - parseDay(a)) / 86400000;

/** Replay immutable evidence; returns overdue tasks instead of discarding late records. */
export function lossMitigationCase(input: MitigationInput) {
  parseDay(input.receivedOn); parseDay(input.asOf);
  if (!input.companyId || !input.loanId || !input.caseId || input.asOf < input.receivedOn) throw new Error('invalid case scope/date');
  const options = input.availableOptions.map(o => o.id);
  if (!options.length || options.some(x => !x) || new Set(options).size !== options.length) throw new Error('unique bank option catalog required');
  const receiptLead = input.saleDateAtReceipt ? days(input.receivedOn, input.saleDateAtReceipt) : Infinity;
  const tasks: { kind: string; dueOn: string; completedOn?: string }[] = [];
  if (receiptLead >= 45) tasks.push({ kind: 'acknowledge', dueOn: addBusinessDays(input.receivedOn, 5, input.publicHolidays) });
  let status = 'received', lastOn = input.receivedOn, completeOn: string | undefined;
  let completeLead = Infinity, reviewer: string | undefined, offered: readonly string[] = [];
  let appealDeadline: string | undefined, responseDeadline: string | undefined;
  let canAppeal = false;
  const evidence = new Set<string>();
  const finish = (kind: string, on: string) => { const task = tasks.find(t => t.kind === kind && !t.completedOn); if (task) task.completedOn = on; };
  for (const event of input.events) {
    parseDay(event.on);
    if (event.companyId !== input.companyId || event.loanId !== input.loanId || event.caseId !== input.caseId) throw new Error('case scope mismatch');
    if (!event.evidenceId || evidence.has(event.evidenceId) || event.on < lastOn || event.on > input.asOf) throw new Error('duplicate evidence or invalid event chronology');
    evidence.add(event.evidenceId); lastOn = event.on;
    switch (event.type) {
      case 'acknowledge':
        if (status !== 'received') throw new Error('acknowledgment transition invalid');
        if (event.missingDocuments.length) {
          if (!event.reasonableCompletionDate || days(event.on, event.reasonableCompletionDate) <= 0) throw new Error('reasonable completion date required');
          status = 'awaiting_documents';
        } else status = 'acknowledged';
        finish('acknowledge', event.on); break;
      case 'complete':
        if (!['received', 'awaiting_documents', 'acknowledged'].includes(status) || !event.borrowerDocumentsComplete) throw new Error('completeness transition invalid');
        completeOn = event.on;
        completeLead = input.saleDateAtCompletion ? days(completeOn, input.saleDateAtCompletion) : Infinity;
        status = 'complete';
        if (completeLead > 37) {
          tasks.push({ kind: 'complete_notice', dueOn: addBusinessDays(completeOn, 5, input.publicHolidays) });
          tasks.push({ kind: 'decision_notice', dueOn: addDays(completeOn, 30) });
        }
        break;
      case 'complete_notice':
        if (status !== 'complete') throw new Error('complete notice transition invalid');
        finish('complete_notice', event.on); finish('acknowledge', event.on); status = 'evaluating'; break;
      case 'decide': {
        if (!['complete', 'evaluating'].includes(status) || !event.reviewerId) throw new Error('evaluation transition invalid');
        const ids = event.decisions.map(d => d.optionId);
        if (ids.length !== options.length || new Set(ids).size !== ids.length || options.some(id => !ids.includes(id)) || event.decisions.some(d => !d.reason.trim())) throw new Error('evaluate every available option with reasons');
        reviewer = event.reviewerId;
        offered = event.decisions.filter(d => d.offered).map(d => d.optionId);
        canAppeal = (completeLead >= 90 || input.beforeFirstForeclosureNotice) && event.decisions.some(d => !d.offered && input.availableOptions.find(o => o.id === d.optionId)?.modification === true);
        appealDeadline = canAppeal ? addDays(event.on, 14) : undefined;
        responseDeadline = addDays(event.on, completeLead >= 90 ? 14 : 7);
        finish('decision_notice', event.on); finish('complete_notice', event.on);
        status = 'decision_delivered'; break;
      }
      case 'appeal':
        if (status !== 'decision_delivered' || !canAppeal || !appealDeadline || event.on > appealDeadline) throw new Error('appeal unavailable or late');
        status = 'appeal_pending'; tasks.push({ kind: 'appeal_notice', dueOn: addDays(event.on, 30) }); break;
      case 'appeal_decision':
        if (status !== 'appeal_pending' || !event.reviewerId || event.reviewerId === reviewer || !event.reason.trim() || event.offeredOptionIds.some(id => !options.includes(id))) throw new Error('independent appeal review required');
        // Previously offered options remain available through the appeal response period.
        offered = [...new Set([...offered, ...event.offeredOptionIds])];
        finish('appeal_notice', event.on); responseDeadline = addDays(event.on, 14); status = 'appeal_decided'; break;
      case 'accept':
        if (!['decision_delivered', 'appeal_decided'].includes(status) || !offered.includes(event.optionId) || !responseDeadline || event.on > responseDeadline) throw new Error('offer acceptance invalid; route late acceptance to review');
        status = 'plan_accepted'; break;
      case 'reject':
        if (!['decision_delivered', 'appeal_decided'].includes(status)) throw new Error('rejection transition invalid');
        status = 'borrower_rejected'; break;
      case 'plan_performing': case 'plan_failed':
        if (!['plan_accepted', 'plan_performing'].includes(status)) throw new Error('plan transition invalid');
        status = event.type; break;
    }
  }
  return { status: input.profile === 'specialist_review' ? 'specialist_review' : status,
    completeOn, offeredOptionIds: offered, appealDeadline, responseDeadline,
    tasks: tasks.map(t => ({ ...t, overdue: (t.completedOn ?? input.asOf) > t.dueOn })),
    foreclosureAction: 'blocked_pending_bank_counsel_review' as const,
    events: input.events.map(e => ({ ...e })),
  };
}

/** R15: repeat contact deadlines for each missed monthly due date; ordinary profile.
 * Notice content and actual delivery remain recorded bank evidence. */
export function earlyIntervention(input: {
  missedDueDates: readonly string[]; asOf: string;
  contacts: readonly { on: string; evidenceId: string }[];
  writtenNotices: readonly { on: string; evidenceId: string }[];
  profile: 'ordinary' | 'specialist_review';
}) {
  parseDay(input.asOf);
  const validate = (e: { on: string; evidenceId: string }) => { parseDay(e.on); if (!e.evidenceId || e.on > input.asOf) throw new Error('invalid intervention evidence'); };
  input.contacts.forEach(validate); input.writtenNotices.forEach(validate);
  const dues = [...new Set(input.missedDueDates)].sort();
  const tasks = dues.map(due => {
    parseDay(due); if (due > input.asOf) throw new Error('future missed payment');
    const contactDue = addDays(due, 36), writtenDue = addDays(due, 45);
    const contact = input.contacts.find(e => e.on >= due && e.on <= contactDue);
    // Once in a 180-day period is sufficient; retain the first day-45 deadline.
    const written = input.writtenNotices.find(e => e.on >= addDays(writtenDue, -180) && e.on <= writtenDue && e.on >= dues[0]);
    return { due, contactDue, writtenDue, contactOverdue: input.asOf > contactDue && !contact, writtenOverdue: input.asOf > writtenDue && !written };
  });
  return { status: input.profile === 'specialist_review' ? 'specialist_review' : 'tracking', tasks };
}
