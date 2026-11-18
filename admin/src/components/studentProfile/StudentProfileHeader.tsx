import { useEffect, useState } from "react";
import { CreditCard, FileDown, GraduationCap, Pencil, Printer, UserRound } from "lucide-react";
import { formatDate, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { profile360Text } from "../../features/students/StudentProfile360.text";
import { STUDENT_STATUS_BADGE_CLASS, studentStatus, studentStatusLabel } from "../../utils/studentStatus";

const actionClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-600 dark:hover:text-teal-300";

export default function StudentProfileHeader({ student, details, onEdit, onPrint, onMarksheet, onCollectFee }: {
  student: any; details: any; onEdit: () => void; onPrint: () => void; onMarksheet: () => void; onCollectFee: () => void;
}) {
  const tx = useText(profile360Text);
  const lang = useLang();
  const image = details?.image || student.image;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [image]);
  const name = lang === "en" ? details?.name_en || student.nameEn || student.nameBn : student.nameBn || details?.name_bn || student.nameEn;
  const className = student.classRef?.nameBn || student.classRef?.name || details?.current_class;
  return <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
    <div className="absolute inset-y-0 start-0 w-1 bg-teal-600" />
    <div className="grid items-center gap-5 lg:grid-cols-2 lg:gap-8">
    <div className="flex items-start gap-4">
      <div data-student-avatar className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-teal-50 text-teal-600 dark:border-slate-700 dark:bg-teal-950/40 dark:text-teal-400">
        {image && !imageFailed ? <img src={image} alt={name || tx.profileTitle} onError={() => setImageFailed(true)} className="h-full w-full object-cover" /> : <UserRound size={32} strokeWidth={1.4} aria-label={tx.noPhoto} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">{tx.profileTitle}</p>
        <h1 className="break-words text-xl font-bold leading-snug text-slate-900 sm:text-2xl dark:text-slate-50">{name || tx.none}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          {className && <span className="inline-flex items-center gap-1.5"><GraduationCap size={14} aria-hidden="true" />{className}</span>}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STUDENT_STATUS_BADGE_CLASS[studentStatus(student.isActive)]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{studentStatusLabel(student.isActive)}</span>
        </div>
      </div>
    </div>
    <div className="min-w-0 space-y-4 border-t border-slate-100 pt-4 lg:border-s lg:border-t-0 lg:ps-6 lg:pt-0 dark:border-slate-800">
    <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
      {[
        { label: tx.registration, value: student.registrationNo != null ? localizeDigits(student.registrationNo, lang) : "—" },
        { label: tx.roll, value: student.roll != null ? localizeDigits(student.roll, lang) : "—" },
        { label: tx.session, value: student.academicYear || details?.academic_year || "—" },
        { label: tx.admissionDate, value: student.admissionDate || details?.admission_date ? formatDate(student.admissionDate || details.admission_date, lang) : "—" },
      ].map(item => <div key={item.label} className="min-w-0"><dt className="mb-1 text-xs text-slate-500 dark:text-slate-400">{item.label}</dt><dd className="break-words text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{item.value}</dd></div>)}
    </dl>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onEdit} className={actionClass}><Pencil size={14} />{tx.edit}</button>
      <button type="button" onClick={onPrint} className={actionClass}><Printer size={14} />{tx.printIdCard}</button>
      <button type="button" onClick={onMarksheet} className={actionClass}><FileDown size={14} />{tx.downloadMarksheet}</button>
      <button type="button" onClick={onCollectFee} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:bg-teal-600 dark:hover:bg-teal-500"><CreditCard size={14} />{tx.collectFee}</button>
    </div>
    </div>
    </div>
  </header>;
}
