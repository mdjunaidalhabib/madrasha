export type QuestionType = "written" | "short" | "mcq";
export type McqSubquestion = {
  id: string;
  text: string;
  options: string[];
  twoColumn?: boolean;
};
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
  mcqTwoColumn?: boolean;
  mcqSubquestions?: McqSubquestion[];
  answer: string;
  bold?: boolean;
};
export type PaperLayout = {
  headerLineStyle: "none" | "solid" | "double" | "dashed" | "dotted";
  headerLineThickness: number;
  footerText: string;
  questionSpacing: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  instructionsBold: boolean;
  examBold: boolean;
  divisionBold: boolean;
  classBold: boolean;
  subjectBold: boolean;
  durationBold: boolean;
  marksBold: boolean;
  footerBold: boolean;
};
export const defaultPaperLayout = (lang = "bn"): PaperLayout => ({
  headerLineStyle: "solid",
  headerLineThickness: 1,
  footerText: lang === "bn" ? "প্রশ্নপত্রের সমাপ্তি" : "End of question paper",
  questionSpacing: 10,
  marginTop: 10,
  marginRight: 10,
  marginBottom: 10,
  marginLeft: 10,
  instructionsBold: false,
  examBold: true,
  divisionBold: false,
  classBold: false,
  subjectBold: false,
  durationBold: false,
  marksBold: false,
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
  mcqTwoColumn: false,
  answer: "",
});

const subquestionLetters = Array.from("কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ");

export const subquestionLabel = (index: number, lang: string) =>
  lang === "bn"
    ? Array.from("\u0995\u0996\u0997\u0998\u0999\u099a\u099b\u099c\u099d\u099e\u099f\u09a0\u09a1\u09a2\u09a3\u09a4\u09a5\u09a6\u09a7\u09a8\u09aa\u09ab\u09ac\u09ad\u09ae\u09af\u09b0\u09b2\u09b6\u09b7\u09b8\u09b9")[index] ?? `${index + 1}`
    : String.fromCharCode(97 + index);

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
    (q.type === "mcq" && q.options.some((o) => !o.trim())) ||
    (q.mcqSubquestions ?? []).some(
      (subquestion) => !subquestion.text.trim() || subquestion.options.some((option) => !option.trim()),
    )
  );
}

export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export const bracketLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `[${line}]`)
    .join("\n");

// A dedicated document keeps dashboard chrome out of the printed paper.
export function printPaper(
  p: QuestionPaper,
  labels: { division: string; className: string; subject: string; duration: string; marks: string; question: string },
  number: (n: number) => string,
  lang = "bn",
): void {
  const e = escapeHtml;
  const layout = { ...defaultPaperLayout(), ...p.layout };
  const lineThickness = layout.headerLineStyle === "double"
    ? layout.headerLineThickness + 2 : layout.headerLineThickness;
  const headerLine = layout.headerLineStyle === "none" ? "" :
    `<div aria-hidden="true" style="width:100%;height:0;margin:6px 0;border-top:${lineThickness}px ${e(layout.headerLineStyle)} currentColor"></div>`;
  const questionHtml = p.questions.map((q, i) => {
    const childQuestions = q.type === "mcq" ? [] : q.mcqSubquestions ?? [];
    const subquestions = childQuestions.length
      ? `<div class="subquestions${childQuestions.some((item) => item.twoColumn) ? " has-two-column" : ""}">${childQuestions.map((subquestion, subIndex) =>
          `<div class="subquestion${subquestion.twoColumn ? " two-column" : ""}"><p><b>${e(subquestionLabel(subIndex, lang))}.</b> ${e(subquestion.text)}</p><div class="options">${subquestion.options.map((option, optionIndex) => `<div class="text">${e(number(optionIndex + 1))}) ${e(option)}</div>`).join("")}</div></div>`,
        ).join("")}</div>`
      : "";
    return `<section class="question${q.mcqTwoColumn ? " question-two-column" : " question-full-width"}${q.bold ? " question-bold" : ""}"><div class="line"><div class="text"><b>${e(labels.question)} ${e(number(i + 1))}.</b> ${e(q.text)}</div><b class="marks">[${e(number(q.marks))}]</b></div>${q.type === "mcq" ? `<div class="options">${q.options.map((o, j) => `<div class="text">${e(number(j + 1))}) ${e(o)}</div>`).join("")}</div>` : ""}${subquestions}</section>`;
  }).join("");
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
    @page{size:A4;margin:${layout.marginTop}mm ${layout.marginRight}mm ${layout.marginBottom}mm ${layout.marginLeft}mm}body{font-family:Arial,sans-serif;color:#111;font-size:12pt;line-height:1.6}h1,h2,p{margin:0}header{text-align:center;padding-bottom:0}h1{font-size:21pt;line-height:1.35;overflow-wrap:anywhere}.address{line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}h2{font-size:15pt;margin:6px 0}.class-subject{display:flex;justify-content:center;align-items:center;gap:2px;font-size:11pt;line-height:1.35}.class-subject span{min-width:0;flex:0 1 auto;padding:0 4px;overflow-wrap:anywhere}.class-subject span+span{border-left:1px solid #cbd5e1}.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:0;font-size:11pt}.instructions{white-space:pre-wrap;text-align:center;padding:0;font-weight:${layout.instructionsBold ? 700 : 400}}.questions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px;row-gap:${layout.questionSpacing}px;align-items:start}.question{break-inside:avoid;margin:0}.question-full-width{grid-column:1/-1}.question .line .text b,.question .marks{font-weight:400}.question-bold .text,.question-bold .options,.question-bold .marks{font-weight:700}.question-bold .line .text b{font-weight:700}.line{display:flex;justify-content:space-between;gap:16px}.text{white-space:pre-wrap;overflow-wrap:anywhere}.marks{white-space:nowrap}.options{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:8px 0 0 20px}.subquestions{display:grid;gap:8px;margin:8px 0 0 14px}.subquestions.has-two-column{grid-template-columns:repeat(2,minmax(0,1fr))}.subquestion{grid-column:1/-1;min-width:0}.subquestion.two-column{grid-column:span 1}.subquestion>p{white-space:pre-wrap;overflow-wrap:anywhere}.subquestion .options{margin:4px 0 0 12px}footer{text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:20px;font-weight:${layout.footerBold ? 700 : 400}}
    </style></head><body><header><h1>${e(p.institution)}</h1>${p.address ? `<p class="address" dir="auto">${e(p.address)}</p>` : ""}<h2 style="font-weight:${layout.examBold ? 700 : 400}">${e(p.title)}</h2><div class="class-subject">${p.divisionName ? `<span style="font-weight:${layout.divisionBold ? 700 : 400}">${e(labels.division)}: ${e(p.divisionName)}</span>` : ""}<span style="font-weight:${layout.classBold ? 700 : 400}">${e(labels.className)}: ${e(p.className)}</span><span style="font-weight:${layout.subjectBold ? 700 : 400}">${e(labels.subject)}: ${e(p.subject)}</span></div><div class="meta"><span style="font-weight:${layout.durationBold ? 700 : 400}">${e(labels.duration)}: ${e(p.duration)}</span><span style="font-weight:${layout.marksBold ? 700 : 400}">${e(labels.marks)}: ${e(number(totalMarks(p)))}</span></div>${headerLine}</header>${p.instructions ? `<div class="instructions" dir="auto">${e(bracketLines(p.instructions))}</div>` : ""}<main class="questions">${questionHtml}</main>${layout.footerText ? `<footer dir="auto">${e(bracketLines(layout.footerText))}</footer>` : ""}</body></html>`);
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
