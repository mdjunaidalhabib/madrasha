import { activityAction, activityDetails, activityEntity, bnNumber, type PlatformActivity } from "./platformActivity";

const date = (value: string) => new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function PlatformActivityTable({ rows, compact = false }: { rows: PlatformActivity[]; compact?: boolean }) {
  if (!rows.length) return <p className="p-6 text-sm text-slate-500">কোনো কার্যক্রম পাওয়া যায়নি।</p>;
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[850px] text-start text-sm">
      <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr>
        {["সময়", "প্রতিষ্ঠান", "সুপার অ্যাডমিন", "কার্যক্রম", "সংশ্লিষ্ট রেকর্ড", "বিস্তারিত"].map((label) => <th key={label} className="px-4 py-3 text-start">{label}</th>)}
      </tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 align-top dark:border-slate-800">
        <td className="whitespace-nowrap px-4 py-4 text-slate-500 dark:text-slate-400">{date(row.created_at)}</td>
        <td className="min-w-32 px-4 py-4 dark:text-slate-200">{row.madrasa_name || "প্ল্যাটফর্ম পর্যায়"}</td>
        <td className="min-w-32 px-4 py-4 dark:text-slate-200">{row.user_name || "পুরোনো লগে নাম সংরক্ষিত নেই"}</td>
        <td className="min-w-40 px-4 py-4"><span className="inline-block rounded-lg bg-blue-50 px-2 py-1 leading-6 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{activityAction(row)}</span></td>
        <td className="min-w-36 px-4 py-4 dark:text-slate-200">{activityEntity(row)}{row.entity_id != null && <span className="mt-1 block text-xs text-slate-500">আসল আইডি: {bnNumber(row.entity_id)}</span>}</td>
        <td className="min-w-72 max-w-xl px-4 py-4 text-slate-600 dark:text-slate-300">{compact ? <details><summary className="cursor-pointer text-blue-700 dark:text-blue-300">বিস্তারিত দেখুন</summary><p className="mt-3 whitespace-pre-wrap break-words leading-7">{activityDetails(row)}</p></details> : <p className="whitespace-pre-wrap break-words leading-7">{activityDetails(row)}</p>}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
