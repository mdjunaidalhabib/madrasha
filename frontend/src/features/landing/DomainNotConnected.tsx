export default function DomainNotConnected() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">এই ডোমেইনে কোনো সাইট কনফিগার করা নেই</h1>
        <p className="mt-2 text-sm text-slate-500">
          এই ডোমেইনটি এখনো কোনো মাদ্রাসার সাথে সংযুক্ত করা হয়নি।
        </p>
      </div>
    </div>
  );
}
