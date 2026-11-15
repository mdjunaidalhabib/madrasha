import { useEffect, useState } from "react";
import { useText } from "../i18n";

declare global {
  interface Window {
    __EMS_OFFLINE_SHELL__?: boolean;
  }
}

const text = {
  bn: {
    offline:
      "ইন্টারনেট সংযোগ নেই। নতুন তথ্য দেখতে বা পরিবর্তন সংরক্ষণ করতে সংযোগ প্রয়োজন।",
  },
  en: {
    offline: "You are offline. Reconnect to load current data or save changes.",
  },
};

export default function NetworkStatus() {
  const [online, setOnline] = useState(
    navigator.onLine && !window.__EMS_OFFLINE_SHELL__,
  );
  const t = useText(text);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online ? null : (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[10000] bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 shadow print:hidden"
    >
      {t.offline}
    </div>
  );
}
