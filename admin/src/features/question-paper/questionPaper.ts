export type QuestionType = "written" | "short" | "mcq";
export type PaperExam = {
  id: number;
  name: string;
  year: string;
  startDate: string | null;
  endDate: string | null;
  divisionIds: number[];
};

// Prefer a running exam, then the nearest upcoming exam. Undated exams
// retain the institution's configured order; finished exams come last.
export function defaultPaperExam(
  exams: PaperExam[],
  divisionId: number | null,
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
) {
  const candidates = exams.filter(
    (exam) =>
      !exam.divisionIds.length || (divisionId !== null && exam.divisionIds.includes(divisionId)),
  );
  const date = (value: string | null) => value?.slice(0, 10) || "";
  const running = candidates.find(
    (exam) =>
      date(exam.startDate) &&
      date(exam.startDate) <= today &&
      date(exam.endDate || exam.startDate) >= today,
  );
  const upcoming = candidates
    .filter((exam) => date(exam.startDate) > today)
    .sort((a, b) => date(a.startDate).localeCompare(date(b.startDate)))[0];
  const undated = candidates.find((exam) => !exam.startDate && !exam.endDate);
  const recent = candidates
    .filter(
      (exam) =>
        date(exam.endDate || exam.startDate) && date(exam.endDate || exam.startDate) < today,
    )
    .sort((a, b) =>
      date(b.endDate || b.startDate).localeCompare(date(a.endDate || a.startDate)),
    )[0];
  return running || upcoming || undated || recent;
}

export const paperExamTitle = (exam: PaperExam) => `${exam.name} ${exam.year}`.trim().slice(0, 200);
export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  options: string[];
  answer: string;
  bold?: boolean;
};
export type PaperLayout = {
  headerLineStyle: "none" | "solid" | "double" | "dashed" | "dotted";
  headerLineThickness: number;
  footerText: string;
  questionSpacing: number;
  instructionsBold: boolean;
  footerBold: boolean;
};
export const defaultPaperLayout = (lang = "bn"): PaperLayout => ({
  headerLineStyle: "solid",
  headerLineThickness: 1,
  footerText: lang === "bn" ? "প্রশ্নপত্রের সমাপ্তি" : "End of question paper",
  questionSpacing: 10,
  instructionsBold: false,
  footerBold: false,
});
export type QuestionPaper = {
  id: string;
  institution: string;
  address: string;
  divisionId: number | null;
  classId: number | null;
  subjectId: number | null;
  divisionName: string;
  title: string;
  subject: string;
  className: string;
  duration: string;
  instructions: string;
  layout?: Partial<PaperLayout>;
  questions: Question[];
  updatedAt: string;
};

export const newQuestion = (): Question => ({
  id: crypto.randomUUID(),
  type: "written",
  text: "",
  marks: 10,
  options: ["", "", "", ""],
  answer: "",
});

const subquestionLetters = Array.from("কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ");

export function appendSubquestion(text: string): string {
  let last = -1;
  for (const match of Array.from(text.matchAll(/^[\t ]*([ক-হ])[.)।]/gm))) {
    last = Math.max(last, subquestionLetters.indexOf(match[1]));
  }
  const letter = subquestionLetters[last + 1];
  if (!letter) return text;
  const next = `${text}${text && !text.endsWith("\n") ? "\n" : ""}${letter}) `;
  return next.length <= 10000 ? next : text;
}

export const newPaper = (lang = "bn"): QuestionPaper => ({
  id: crypto.randomUUID(),
  institution: "",
  address: "",
  divisionId: null,
  classId: null,
  subjectId: null,
  divisionName: "",
  title: "",
  subject: "",
  className: "",
  duration: lang === "bn" ? "৩ ঘণ্টা" : "3 hours",
  instructions: lang === "bn" ? "সকল প্রশ্নের উত্তর দাও।" : "Answer all questions.",
  layout: defaultPaperLayout(lang),
  questions: [],
  updatedAt: new Date().toISOString(),
});

// The paper's full marks are fixed independently of individual question marks.
export const totalMarks = (_paper: QuestionPaper) => 100;

export function questionError(q: Question): boolean {
  return (
    !q.text.trim() ||
    !Number.isFinite(q.marks) ||
    q.marks <= 0 ||
    (q.type === "mcq" &&
      (q.options.some((o) => !o.trim()) || !["0", "1", "2", "3"].includes(q.answer)))
  );
}

export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

// A dedicated document keeps dashboard chrome and answer keys out of the printed paper.
export function printPaper(
  p: QuestionPaper,
  labels: { className: string; subject: string; duration: string; marks: string; question: string },
  number: (n: number) => string,
): void {
  const e = escapeHtml;
  const layout = { ...defaultPaperLayout(), ...p.layout };
  const lineThickness = layout.headerLineStyle === "double"
    ? layout.headerLineThickness + 2 : layout.headerLineThickness;
  const headerLine = layout.headerLineStyle === "none" ? "" :
    `<div aria-hidden="true" style="width:100%;height:0;margin:6px 0;border-top:${lineThickness}px ${e(layout.headerLineStyle)} currentColor"></div>`;
  const frame = document.createElement("iframe");
  frame.title = "Question paper print";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;bottom:0;right:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Print unavailable");
  }
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${e(p.title)}</title><style>
    @page{size:A4;margin:14mm 18mm 18mm}body{font-family:Arial,sans-serif;color:#111;font-size:12pt;line-height:1.6}h1,h2,p{margin:0}header{text-align:center;padding-bottom:0}h1{font-size:21pt;line-height:1.35;overflow-wrap:anywhere}.address{line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}h2{font-size:15pt;margin:6px 0}.class-subject{display:flex;justify-content:center;gap:20px;font-size:11pt}.class-subject span{min-width:0;max-width:calc(50% - 10px);overflow-wrap:anywhere}.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:0;font-size:11pt}.instructions{white-space:pre-wrap;text-align:center;padding:0;font-weight:${layout.instructionsBold ? 700 : 400}}.questions{display:flex;flex-direction:column;gap:${layout.questionSpacing}px}.question{break-inside:avoid;margin:0}.question-bold .text,.question-bold .options{font-weight:700}.line{display:flex;justify-content:space-between;gap:16px}.text{white-space:pre-wrap;overflow-wrap:anywhere}.marks{white-space:nowrap}.options{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:8px 0 0 20px}footer{text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:20px;font-weight:${layout.footerBold ? 700 : 400}}
    </style></head><body><header><h1>${e(p.institution)}</h1>${p.address ? `<p class="address" dir="auto">${e(p.address)}</p>` : ""}<h2>${e(p.title)}</h2><div class="class-subject"><span>${e(labels.className)}: ${e(p.className)}</span><span>${e(labels.subject)}: ${e(p.subject)}</span></div><div class="meta"><span>${e(labels.duration)}: ${e(p.duration)}</span><span>${e(labels.marks)}: ${e(number(totalMarks(p)))}</span></div>${headerLine}</header>${p.instructions ? `<div class="instructions" dir="auto">${e(p.instructions)}</div>` : ""}<main class="questions">${p.questions.map((q, i) => `<section class="question${q.bold ? " question-bold" : ""}"><div class="line"><div class="text"><b>${e(labels.question)} ${e(number(i + 1))}.</b> ${e(q.text)}</div><b class="marks">[${e(number(q.marks))}]</b></div>${q.type === "mcq" ? `<div class="options">${q.options.map((o, j) => `<div class="text">${e(number(j + 1))}) ${e(o)}</div>`).join("")}</div>` : ""}</section>`).join("")}</main>${layout.footerText ? `<footer dir="auto">${e(layout.footerText)}</footer>` : ""}</body></html>`);
  doc.close();
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error("Print unavailable");
  }
  let timer: ReturnType<typeof setTimeout>;
  const clean = () => {
    clearTimeout(timer);
    frame.remove();
  };
  win.addEventListener("afterprint", clean, { once: true });
  timer = setTimeout(clean, 300_000);
  void doc.fonts.ready.then(() => {
    win.focus();
    win.print();
  });
}
