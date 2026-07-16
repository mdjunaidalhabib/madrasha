import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
        <div className="text-5xl font-bold text-blue-600">404</div>
        <h1 className="mt-3 text-xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">আপনি যে পেজটি খুঁজছেন সেটি নেই অথবা URL ভুল।</p>
        <Link
          to="/dashboard"
          className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
