import { Link } from "react-router-dom";
import { Image, Wallet, Users, ShieldCheck } from "lucide-react";

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

        <Link
          to="payment-methods"
          className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
        >
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <Wallet size={22} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">পেমেন্ট পদ্ধতি সেটআপ</div>
            <p className="mt-1 text-sm text-gray-600">
              বিকাশ/নগদ/ব্যাংক নম্বর যোগ করুন — ফি পেমেন্ট রেকর্ড করার সময় এখান থেকে বেছে নেওয়া
              যাবে (সম্পূর্ণ ম্যানুয়াল, কোনো গেটওয়ে নেই)।
            </p>
          </div>
        </Link>

        <Link
          to="users"
          className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
            <Users size={22} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">স্টাফ ব্যবস্থাপনা</div>
            <p className="mt-1 text-sm text-gray-600">
              যারা এই প্যানেলে লগইন করবে তাদের অ্যাকাউন্ট তৈরি করুন এবং রোল নির্ধারণ করুন।
            </p>
          </div>
        </Link>

        <Link
          to="roles"
          className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">রোল ও পারমিশন</div>
            <p className="mt-1 text-sm text-gray-600">
              নতুন রোল তৈরি করুন এবং প্রতিটা মডিউলে কোন রোলের অ্যাক্সেস থাকবে তা নির্ধারণ করুন।
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
