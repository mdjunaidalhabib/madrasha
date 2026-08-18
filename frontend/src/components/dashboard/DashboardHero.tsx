type Props = {
  title: string;
  subtitle: string;
};

export default function DashboardHero({ title, subtitle }: Props) {
  const today = new Date().toLocaleDateString("bn-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-6 text-white shadow-lg shadow-indigo-600/25 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />

      <div className="relative">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-indigo-100 sm:text-base">{subtitle}</p>
        <p className="mt-2 text-xs font-medium text-indigo-100/80">{today}</p>
      </div>
    </div>
  );
}
