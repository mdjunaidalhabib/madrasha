export type QuestionType = "written" | "short" | "mcq";
export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  options: string[];
  answer: string;
};
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
  questions: Question[];
  updatedAt: string;
};

export const newQuestion = (): Question => ({
  id: crypto.randomUUID(),
  type: "written",
  text: "",
  marks: 5,
  options: ["", "", "", ""],
  answer: "",
});

export const newPaper = (): QuestionPaper => ({
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
  duration: "",
  instructions: "",
  questions: [],
  updatedAt: new Date().toISOString(),
});

export const totalMarks = (paper: QuestionPaper) =>
  paper.questions.reduce((sum, q) => sum + q.marks, 0);

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
    @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111;font-size:12pt;line-height:1.75}h1,h2,p{margin:0}header{text-align:center;border-bottom:2px solid #111;padding-bottom:14px}h1{font-size:21pt}h2{font-size:15pt;margin:6px 0}.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:11pt}.instructions{white-space:pre-wrap;border-bottom:1px solid #aaa;padding:14px 0}.question{break-inside:avoid;margin:22px 0}.line{display:flex;justify-content:space-between;gap:16px}.text{white-space:pre-wrap;overflow-wrap:anywhere}.marks{white-space:nowrap}.options{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:8px 0 0 20px}
    </style></head><body><header><p lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p><h1>${e(p.institution)}</h1>${p.address ? `<p>${e(p.address)}</p>` : ""}<h2>${e(p.title)}</h2><p>${e(labels.subject)}: ${e(p.subject)}</p><div class="meta"><span>${e(labels.className)}: ${e(p.className)}</span><span>${e(labels.duration)}: ${e(p.duration)}</span><span>${e(labels.marks)}: ${e(number(totalMarks(p)))}</span></div></header>${p.instructions ? `<div class="instructions">${e(p.instructions)}</div>` : ""}${p.questions.map((q, i) => `<section class="question"><div class="line"><div class="text"><b>${e(labels.question)} ${e(number(i + 1))}.</b> ${e(q.text)}</div><b class="marks">[${e(number(q.marks))}]</b></div>${q.type === "mcq" ? `<div class="options">${q.options.map((o, j) => `<div class="text">${e(number(j + 1))}) ${e(o)}</div>`).join("")}</div>` : ""}</section>`).join("")}</body></html>`);
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
