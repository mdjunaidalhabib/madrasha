import { useState, type ReactNode } from "react";
import {
  GraduationCap,
  Users,
  UserPlus,
  CalendarCheck,
  ClipboardList,
  Wallet,
  BarChart3,
  MessageSquareText,
  Settings,
  Clock,
  ShieldCheck,
  LayoutDashboard,
  Users2,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  PlayCircle,
  Wrench,
  Rocket,
  PhoneCall,
  Menu,
  X,
} from "lucide-react";

const NAV_LINKS = [
  { href: "#about", label: "পরিচিতি" },
  { href: "#why", label: "কেন QMS" },
  { href: "#getting-started", label: "ব্যবহার গাইড" },
  { href: "#service", label: "সেবা নিন" },
  { href: "#contact", label: "যোগাযোগ" },
];

/* ---------------------------------------------------------
   Design tokens for this page:
   - ink        #0b1220  (deep navy-black hero surface)
   - emerald    #059669  (primary brand — trust / growth)
   - emerald-dk #047857
   - gold       #c98a2c  (muted calligraphic accent, used sparingly)
   - surface    slate-50 / white cards on light sections
--------------------------------------------------------- */

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-700">
      {children}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{desc}</p>
    </div>
  );
}

function WhyCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">{desc}</p>
      </div>
    </div>
  );
}

function StepItem({
  index,
  icon,
  title,
  desc,
  isLast,
}: {
  index: string;
  icon: ReactNode;
  title: string;
  desc: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-5">
      <div className="flex flex-col items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white shadow-md shadow-emerald-600/20">
          {icon}
        </div>
        {!isLast && <div className="mt-2 w-px flex-1 bg-emerald-200" />}
      </div>
      <div className="pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          ধাপ {index}
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">{desc}</p>
      </div>
    </div>
  );
}

export default function QmsLandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-white text-slate-900 antialiased"
      style={{ fontFamily: "'Hind Siliguri', 'Manrope', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <GraduationCap size={20} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-slate-900">
                QMS
              </span>
              <span className="block text-[11px] text-slate-500">Qawmi Madrasa System</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-emerald-700">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#contact"
              className="hidden items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 sm:inline-flex"
            >
              ডেমো নিন
              <ArrowRight size={15} />
            </a>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
              aria-expanded={mobileNavOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 md:hidden"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileNavOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg px-3 py-2.5 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setMobileNavOpen(false)}
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                ডেমো নিন
                <ArrowRight size={15} />
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* ---------------- Hero ---------------- */}
      <section id="top" className="relative overflow-hidden bg-[#0b1220]">
        {/* subtle geometric backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Powered by Hikmah IT
            </div>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl">
              কওমি মাদ্রাসা পরিচালনার
              <span className="block text-emerald-400">সম্পূর্ণ ডিজিটাল সমাধান</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              QMS (Qawmi Madrasa Management System) একটি আধুনিক সফটওয়্যার, যা দিয়ে ছাত্র,
              শিক্ষক, ভর্তি, হাজিরা, পরীক্ষা-ফলাফল ও হিসাব — সবকিছু এক জায়গা থেকে সহজে
              পরিচালনা করা যায়।
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#service"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
              >
                সেবাটি নিন
                <ArrowRight size={16} />
              </a>
              <a
                href="#about"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/5"
              >
                আরও জানুন
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                নিরাপদ ও নির্ভরযোগ্য ডেটা
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                বাংলা ভাষায় সম্পূর্ণ ইন্টারফেস
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                মোবাইল ও ডেস্কটপ সাপোর্ট
              </div>
            </div>
          </div>

          {/* Product glimpse: module grid mock */}
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  qms.hikmahit.com/dashboard
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { icon: <Users size={18} />, label: "Students" },
                  { icon: <Users2 size={18} />, label: "Teachers" },
                  { icon: <UserPlus size={18} />, label: "Admission" },
                  { icon: <CalendarCheck size={18} />, label: "Attendance" },
                  { icon: <ClipboardList size={18} />, label: "Examination" },
                  { icon: <Wallet size={18} />, label: "Accounts" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl bg-white/[0.06] p-4 text-slate-200 ring-1 ring-white/5"
                  >
                    <div className="text-emerald-400">{m.icon}</div>
                    <p className="mt-3 text-xs font-semibold">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-xl sm:block">
              <p className="text-[11px] font-medium text-emerald-100">Result প্রস্তুত</p>
              <p className="text-sm font-bold">এক ক্লিকে রিপোর্ট</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- About QMS ---------------- */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>About QMS</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
            মাদ্রাসার সকল কার্যক্রম একটি প্ল্যাটফর্মে
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            কওমি মাদ্রাসার দৈনন্দিন প্রশাসনিক ও একাডেমিক কাজগুলো সহজ ও গোছালো করতে QMS তৈরি
            করা হয়েছে। প্রতিটি মডিউল বাস্তব প্রয়োজন বিবেচনা করে ডিজাইন করা।
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Users size={20} />}
            title="Student Management"
            desc="শিক্ষার্থীদের তথ্য, প্রোফাইল ও একাডেমিক রেকর্ড সহজে সংরক্ষণ ও পরিচালনা করুন।"
          />
          <FeatureCard
            icon={<Users2 size={20} />}
            title="Teacher Management"
            desc="শিক্ষকদের নিয়োগ, প্রোফাইল ও দায়িত্ব বণ্টন এক জায়গা থেকে নিয়ন্ত্রণ করুন।"
          />
          <FeatureCard
            icon={<UserPlus size={20} />}
            title="Admission"
            desc="নতুন শিক্ষার্থী ভর্তি প্রক্রিয়া দ্রুত, নির্ভুল ও ডিজিটালভাবে সম্পন্ন করুন।"
          />
          <FeatureCard
            icon={<CalendarCheck size={20} />}
            title="Attendance"
            desc="দৈনিক হাজিরা রেকর্ড রাখুন এবং উপস্থিতির প্রবণতা সহজে বিশ্লেষণ করুন।"
          />
          <FeatureCard
            icon={<ClipboardList size={20} />}
            title="Examination & Result"
            desc="পরীক্ষা পরিচালনা, নম্বর এন্ট্রি ও ফলাফল প্রকাশ স্বয়ংক্রিয়ভাবে করুন।"
          />
          <FeatureCard
            icon={<Wallet size={20} />}
            title="Accounts"
            desc="আয়-ব্যয়, ফান্ড ও আর্থিক হিসাব স্বচ্ছভাবে ট্র্যাক করুন।"
          />
          <FeatureCard
            icon={<BarChart3 size={20} />}
            title="Reports"
            desc="একাডেমিক, আর্থিক ও প্রশাসনিক রিপোর্ট মুহূর্তেই তৈরি ও প্রিন্ট করুন।"
          />
          <FeatureCard
            icon={<MessageSquareText size={20} />}
            title="SMS / Notification"
            desc="অভিভাবক ও শিক্ষকদের কাছে গুরুত্বপূর্ণ তথ্য দ্রুত পৌঁছে দিন।"
          />
          <FeatureCard
            icon={<Settings size={20} />}
            title="Settings ও অন্যান্য"
            desc="মাদ্রাসার নিজস্ব প্রয়োজন অনুযায়ী সিস্টেম কাস্টমাইজ ও নিয়ন্ত্রণ করুন।"
          />
        </div>
      </section>

      {/* ---------------- Why Choose QMS ---------------- */}
      <section id="why" className="relative overflow-hidden bg-[#0b1220] py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-300">
              Why Choose QMS
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
              কেন আপনার মাদ্রাসার জন্য QMS
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <WhyCard
              icon={<Clock size={20} />}
              title="সময় সাশ্রয়"
              desc="ম্যানুয়াল রেজিস্টার ও হিসাবের ঝামেলা ছাড়াই কাজ হবে দ্রুত ও সহজ।"
            />
            <WhyCard
              icon={<ShieldCheck size={20} />}
              title="নির্ভুল তথ্য সংরক্ষণ"
              desc="প্রতিটি তথ্য নির্ভুলভাবে ডিজিটালি সংরক্ষিত থাকে, ভুলের সম্ভাবনা কমে যায়।"
            />
            <WhyCard
              icon={<BarChart3 size={20} />}
              title="সহজ রিপোর্ট"
              desc="জটিল হিসাব-নিকাশ এক ক্লিকে রিপোর্ট আকারে দেখুন ও প্রিন্ট করুন।"
            />
            <WhyCard
              icon={<ShieldCheck size={20} />}
              title="নিরাপদ ডেটা"
              desc="মাদ্রাসার তথ্য সুরক্ষিত সার্ভারে নিরাপদে সংরক্ষিত থাকে।"
            />
            <WhyCard
              icon={<LayoutDashboard size={20} />}
              title="Modern Dashboard"
              desc="প্রতিদিনের কার্যক্রম এক নজরে দেখার জন্য আধুনিক ড্যাশবোর্ড।"
            />
            <WhyCard
              icon={<Users2 size={20} />}
              title="Multi-user Support"
              desc="প্রশাসন, শিক্ষক ও কর্মচারীরা একসাথে নিজ নিজ দায়িত্বে কাজ করতে পারবেন।"
            />
          </div>
        </div>
      </section>

      {/* ---------------- Getting Started ---------------- */}
      <section id="getting-started" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Getting Started</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
            কীভাবে ব্যবহার শুরু করবেন
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            মাত্র কয়েকটি ধাপে আপনার মাদ্রাসা QMS ব্যবহার শুরু করতে পারবে।
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <StepItem
            index="১"
            icon={<UserPlus size={18} />}
            title="অ্যাকাউন্ট তৈরি"
            desc="আপনার মাদ্রাসার জন্য একটি QMS অ্যাকাউন্ট খুলুন।"
          />
          <StepItem
            index="২"
            icon={<Settings size={18} />}
            title="মাদ্রাসার তথ্য সেটআপ"
            desc="মাদ্রাসার নাম, ঠিকানা, লোগো ও প্রয়োজনীয় তথ্য যুক্ত করুন।"
          />
          <StepItem
            index="৩"
            icon={<Users2 size={18} />}
            title="শিক্ষক ও শিক্ষার্থী যুক্ত করা"
            desc="শিক্ষক ও শিক্ষার্থীদের প্রোফাইল সিস্টেমে যুক্ত করুন।"
          />
          <StepItem
            index="৪"
            icon={<ClipboardList size={18} />}
            title="ক্লাস, বিভাগ ও বিষয় সেটআপ"
            desc="মাদ্রাসার একাডেমিক কাঠামো অনুযায়ী ক্লাস, বিভাগ ও বিষয় নির্ধারণ করুন।"
          />
          <StepItem
            index="৫"
            icon={<LayoutDashboard size={18} />}
            title="দৈনন্দিন ব্যবহার"
            desc="হাজিরা, পরীক্ষা, হিসাব ও রিপোর্ট — প্রতিদিনের কাজে QMS ব্যবহার শুরু করুন।"
            isLast
          />
        </div>
      </section>

      {/* ---------------- How to Get This Service ---------------- */}
      <section id="service" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>How to Get This Service</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
              যেভাবে সেবাটি নিতে পারবেন
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Hikmah IT-এর সহায়তায় সম্পূর্ণ ঝামেলাহীনভাবে QMS চালু করুন।
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                icon: <PhoneCall size={20} />,
                title: "যোগাযোগ",
                desc: "ফোন বা ইমেইলে আমাদের সাথে যোগাযোগ করুন।",
              },
              {
                icon: <PlayCircle size={20} />,
                title: "ডেমো",
                desc: "সিস্টেমের একটি লাইভ ডেমো দেখুন।",
              },
              {
                icon: <Wrench size={20} />,
                title: "সেটআপ",
                desc: "আপনার মাদ্রাসার জন্য সিস্টেম কনফিগার করা হবে।",
              },
              {
                icon: <FileCheck2 size={20} />,
                title: "ট্রেনিং",
                desc: "ব্যবহারকারীদের প্রয়োজনীয় প্রশিক্ষণ দেওয়া হবে।",
              },
              {
                icon: <Rocket size={20} />,
                title: "লাইভ চালু",
                desc: "সম্পূর্ণ প্রস্তুত হয়ে গেলে সিস্টেম লাইভ চালু হবে।",
              },
            ].map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <span className="absolute right-4 top-4 text-2xl font-extrabold text-slate-100">
                  {i + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  {s.icon}
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
            >
              এখনই যোগাযোগ করুন
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ---------------- Contact ---------------- */}
      <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-[#0b1220]">
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="p-8 sm:p-10 lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                Contact Us
              </div>
              <h2 className="mt-4 text-2xl font-extrabold text-white">Hikmah IT</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                আপনার মাদ্রাসার জন্য QMS চালু করতে আজই যোগাযোগ করুন। আমরা আছি প্রতিটি ধাপে
                পাশে।
              </p>
            </div>

            <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3 lg:col-span-3">
              <a
                href="tel:01624114405"
                className="flex flex-col gap-3 bg-[#0b1220] p-8 transition hover:bg-white/[0.03]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Phone size={18} />
                </span>
                <span className="text-xs font-medium text-slate-400">Phone</span>
                <span className="text-sm font-semibold text-white" dir="ltr">
                  01624114405
                </span>
              </a>
              <a
                href="mailto:hikmahitcenter@gmail.com"
                className="flex flex-col gap-3 bg-[#0b1220] p-8 transition hover:bg-white/[0.03]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Mail size={18} />
                </span>
                <span className="text-xs font-medium text-slate-400">Email</span>
                <span className="break-all text-sm font-semibold text-white">
                  hikmahitcenter@gmail.com
                </span>
              </a>
              <div className="flex flex-col gap-3 bg-[#0b1220] p-8">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <MapPin size={18} />
                </span>
                <span className="text-xs font-medium text-slate-400">Address</span>
                <span className="text-sm font-semibold text-white">
                  Jamalpur, Dhaka, Bangladesh
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <GraduationCap size={14} />
            </span>
            <span>
              <span className="font-semibold text-slate-700">QMS</span> — Powered by{" "}
              <span className="font-semibold text-slate-700">Hikmah IT</span>
            </span>
          </div>
          <p>&copy; {new Date().getFullYear()} Hikmah IT. সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
      </footer>
    </div>
  );
}
