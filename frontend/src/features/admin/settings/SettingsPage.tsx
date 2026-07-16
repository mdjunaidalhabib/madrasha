import { Link } from "react-router-dom";
import { Image } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">সেটিংস</h1>
        <p className="mt-1 text-sm text-gray-600">মাদ্রাসার বিভিন্ন সেটিংস এখান থেকে পরিচালনা করুন।</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="branding"
          className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <Image size={22} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">রিপোর্ট ব্র্যান্ডিং</div>
            <p className="mt-1 text-sm text-gray-600">
              মাদ্রাসার নাম, ঠিকানা, লোগো ও ওয়াটারমার্ক দিন — সব রিপোর্টে স্বয়ংক্রিয়ভাবে দেখাবে।
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
