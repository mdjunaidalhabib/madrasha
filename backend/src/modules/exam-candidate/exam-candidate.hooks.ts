/**
 * Circular-import firewall between fee.service.ts and exam-candidate.service.ts.
 *
 * fee.service.ts needs to call into exam-candidate registration logic on a
 * fully-paid invoice, but exam-candidate.service.ts's own dependency
 * (eligibility.service.ts) already imports FeeService from fee.service.ts.
 * A plain top-level `import { examCandidateService } from "./exam-candidate.service"`
 * right here would close that loop back on itself during module load:
 *
 *   fee.service.ts -> exam-candidate.hooks.ts -> exam-candidate.service.ts
 *   -> eligibility.service.ts -> fee.service.ts (again, still mid-load)
 *
 * Node resolves a require cycle by handing back whatever partial exports
 * the re-entered module has produced so far - which module ends up on the
 * "returns partial" side of that depends entirely on load order. In this
 * app, sidebar.service.ts already imports fee.service.ts directly and is
 * wired in earlier than routine/exam-candidate in router.ts, so fee.service.ts
 * is a realistic candidate for being the module that's still mid-load when
 * the cycle closes. eligibility.service.ts wires `feeService` in as a
 * constructor *default parameter* on its module-level `new EligibilityService()`
 * singleton - a value resolved once, eagerly, at that line - so if fee.service.ts
 * were still mid-load at that moment, `feeService` would resolve to
 * `undefined` and get baked into the singleton permanently (breaking every
 * later fee-dues eligibility check, silently, until the process restarts).
 *
 * Deferring the require to call time (well after every module has finished
 * loading, since these functions only ever run in response to a real
 * routine-creation or payment event) sidesteps the whole class of problem.
 * The two wrapper functions below are the only surface fee.service.ts and
 * routine.service.ts see - neither imports exam-candidate.service.ts
 * directly.
 */
import type { ExamCandidateService } from "./exam-candidate.service";

let serviceModule: typeof import("./exam-candidate.service") | undefined;

const getService = (): ExamCandidateService => {
  if (!serviceModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- deliberately lazy, see file header
    serviceModule = require("./exam-candidate.service");
  }
  return serviceModule!.examCandidateService;
};

export const autoRegisterForRoutine = (
  ...args: Parameters<ExamCandidateService["autoRegisterForRoutine"]>
): ReturnType<ExamCandidateService["autoRegisterForRoutine"]> => getService().autoRegisterForRoutine(...args);

export const autoRegisterOnInvoicePaid = (
  ...args: Parameters<ExamCandidateService["autoRegisterOnInvoicePaid"]>
): ReturnType<ExamCandidateService["autoRegisterOnInvoicePaid"]> => getService().autoRegisterOnInvoicePaid(...args);
