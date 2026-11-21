import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Megaphone,
  Wallet,
} from "lucide-react";
import guardianApi, { GUARDIAN_TENANT_BLOCK_STORAGE_KEY } from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import TenantBlockedScreen, {
  type TenantBlockInfo,
} from "@madrasha/shared-ui/src/components/ui/TenantBlockedScreen";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import { LanguageSwitcher, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";
import "./guardian.css";

export default function GuardianLoginPage() {
  const t = useText(guardianText);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Set either when this login attempt itself fails with 410/423 (madrasa
  // suspended/deleted), or on mount when guardianApi.ts's response
  // interceptor redirected here after that happened mid-session. While set,
  // the form is replaced by TenantBlockedScreen instead of staying usable.
  const [tenantBlock, setTenantBlock] = useState<TenantBlockInfo | null>(null);

  const setAuth = useGuardianAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);

  useEffect(() => {
    try {
      const stashed = window.sessionStorage.getItem(GUARDIAN_TENANT_BLOCK_STORAGE_KEY);
      if (stashed) {
        window.sessionStorage.removeItem(GUARDIAN_TENANT_BLOCK_STORAGE_KEY);
        setTenantBlock(JSON.parse(stashed));
      }
    } catch {
      // ignore storage/parse errors (e.g. private browsing mode)
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await guardianApi.post("/guardian/login", { phone, password });
      setAuth({ token: res.data.token, guardian: res.data.guardian });

      if (res.data.guardian.mustChangePassword) {
        nav(`${base}/change-password`);
      } else {
        nav(`${base}/dashboard`);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 410 || status === 423) {
        setTenantBlock({ status, message: err?.response?.data?.message });
      }
      // Otherwise guardianApi's response interceptor already shows the
      // server error as a toast.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="guardian-login">
      <section className="guardian-login-story">
        <div className="guardian-login-brand">
          <BookOpen size={28} strokeWidth={1.5} />
          <strong>{t.panelTitle}</strong>
        </div>
        <div className="guardian-login-message">
          <span className="guardian-login-emblem">
            <GraduationCap size={76} strokeWidth={1} />
          </span>
          <p>{t.learningTogether}</p>
          <h1>{t.loginWelcome}</h1>
          <p>{t.loginDescription}</p>
          <div className="guardian-login-features">
            <span>
              <CalendarCheck size={19} />
              {t.attendance}
            </span>
            <span>
              <GraduationCap size={19} />
              {t.results}
            </span>
            <span>
              <Wallet size={19} />
              {t.fees}
            </span>
            <span>
              <Megaphone size={19} />
              {t.notices}
            </span>
          </div>
        </div>
        <p className="guardian-login-tagline">{t.portalTagline}</p>
      </section>
      <div className="guardian-login-form-area">
        <div className="guardian-login-card text-slate-900">
          {!tenantBlock && (
            <div className="flex items-center justify-between gap-2">
              <span className="guardian-login-small-brand">
                <BookOpen size={21} />
                {t.panelTitle}
              </span>
              <LanguageSwitcher />
            </div>
          )}

          {tenantBlock && (
            <TenantBlockedScreen
              status={tenantBlock.status}
              message={tenantBlock.message}
              onBack={() => setTenantBlock(null)}
              backLabel={t.tryAgain}
            />
          )}

          {!tenantBlock && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleLogin();
              }}
              className="guardian-login-form"
            >
              <div className="guardian-login-heading">
                <h2>{t.loginTitle}</h2>
                <p>{t.loginHint}</p>
              </div>
              <p className="guardian-login-institution">
                {t.institutionLabel} <b>{madrasaSlug || "demo-madrasa"}</b>
              </p>

              <label className="guardian-login-label" htmlFor="guardian-phone">
                {t.mobileNumber}
              </label>
              <Input
                id="guardian-phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder={t.mobileNumber}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="dark:border-slate-200 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:hover:border-slate-300"
              />

              <label className="guardian-login-label" htmlFor="guardian-password">
                {t.password}
              </label>
              <div className="relative">
                <Input
                  id="guardian-password"
                  autoComplete="current-password"
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder={t.password}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pe-10 dark:border-slate-200 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <p className="guardian-login-help">{t.firstLoginHint}</p>

              <Button type="submit" disabled={loading} className="guardian-login-submit w-full">
                {loading ? t.loggingIn : t.login}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
