export default function UnauthorizedPage() {
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow">
      <div className="text-4xl">🔒</div>
      <h1 className="mt-3 text-xl font-bold text-gray-900">Access restricted</h1>
      <p className="mt-2 text-sm text-gray-600">
        এই module ব্যবহারের permission আপনার account-এ নেই।
      </p>
    </div>
  );
}
