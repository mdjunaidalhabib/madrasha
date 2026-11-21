import { useEffect, useState, type ReactNode } from "react";
import { resolveAdminDomain } from "../store/adminDomainStore";
import { useAuthStore } from "../store/authStore";
import { setupBrandIcons } from "../utils/brandIcons";
import { useText } from "@madrasha/shared-ui/src/i18n";

const text = {
  bn: {
    loading: "লোড হচ্ছে…",
    failed: "সংযোগ করা যায়নি। আবার চেষ্টা করুন।",
    retry: "আবার চেষ্টা করুন",
  },
  en: { loading: "Loading…", failed: "Could not connect. Please try again.", retry: "Try again" },
};
let bootstrap: Promise<void> | null = null;
function initialize() {
  if (!bootstrap)
    bootstrap = resolveAdminDomain()
      .then((institution) => {
        const auth = useAuthStore.getState();
        if (institution && auth.token && auth.madrasaSlug !== institution.slug) auth.logout();
        setupBrandIcons(institution);
      })
      .catch((error) => {
        bootstrap = null;
        throw error;
      });
  return bootstrap;
}

export default function AdminDomainGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const t = useText(text);
  useEffect(() => {
    let active = true;
    initialize()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (ready) return children;
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div role="status">
        <p>{failed ? t.failed : t.loading}</p>
        {failed && (
          <button
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            {t.retry}
          </button>
        )}
      </div>
    </div>
  );
}
