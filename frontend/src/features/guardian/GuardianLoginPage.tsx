import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  Eye,
  EyeOff,
  GraduationCap,
  Megaphone,
  MapPin,
  LockKeyhole,
  Timer,
  Phone,
  Wallet,
  KeyRound,
  CircleHelp,
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
import { LanguageSwitcher, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";
import { useGuardianBrand } from "./useGuardianBrand";
import { useGuardianLightTheme } from "./useGuardianLightTheme";
import { guardianLoginText } from "./guardianLogin.text";
import { normalizeGuardianPhone, validateGuardianLogin } from "./guardianLoginValidation";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useLoginCooldown } from "./useLoginCooldown";
import { formatLoginCountdown, getLoginRetrySeconds } from "./loginCooldown";
import GuardianAppInstall from "./GuardianAppInstall";
import "./guardian.css";

export default function GuardianLoginPage() {
  useGuardianLightTheme();
  const t = useText(guardianText);
  const loginText = useText(guardianLoginText);
  const lang = useLang();
  const toast = useToastStore((state) => state.push);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<{ slug: string; phone: string; remaining: number } | null>(null);
  const [errors, setErrors] = useState<{ phone: string | null; password: string | null }>({ phone: null, password: null });
  // Set either when this login attempt itself fails with 410/423 (madrasa
  // suspended/deleted), or on mount when guardianApi.ts's response
  // interceptor redirected here after that happened mid-session. While set,
  // the form is replaced by TenantBlockedScreen instead of staying usable.
  const [tenantBlock, setTenantBlock] = useState<TenantBlockInfo | null>(null);

  const setAuth = useGuardianAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const madrasaSlug = useTenantSlug();
  const cooldown = useLoginCooldown(madrasaSlug);
  const countdown = localizeDigits(formatLoginCountdown(cooldown.remaining), lang);
  const brand = useGuardianBrand(madrasaSlug);
  const base = getTenantGuardianBase(madrasaSlug);
  const remainingAttempts = attempts?.slug === madrasaSlug && attempts.phone === normalizeGuardianPhone(phone)
    ? attempts.remaining : null;

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
    if (loading || cooldown.isBlocked()) return;
    const validation = validateGuardianLogin(phone, password);
    const nextErrors = {
      phone: validation.phone ? loginText[validation.phone] : null,
      password: validation.password ? loginText[validation.password] : null,
    };
    setErrors(nextErrors);
    if (nextErrors.phone || nextErrors.password) {
      toast("error", (nextErrors.phone || nextErrors.password)!);
      document.getElementById(nextErrors.phone ? "guardian-phone" : "guardian-password")?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await guardianApi.post("/guardian/login", { phone: normalizeGuardianPhone(phone), password });
      setAuth({ token: res.data.token, guardian: res.data.guardian });
      toast("success", loginText.loginSuccess);

      if (res.data.guardian.mustChangePassword) {
        nav(`${base}/change-password`);
      } else {
        nav(`${base}/dashboard`);
      }
    } catch (err: any) {
      cooldown.start(getLoginRetrySeconds(err?.response));
      const failure = err?.response?.data;
      setAttempts(failure?.code === "GUARDIAN_LOGIN_INVALID"
        && Number.isInteger(failure.remainingAttempts) && failure.remainingAttempts > 0
        ? { slug: madrasaSlug, phone: normalizeGuardianPhone(phone), remaining: failure.remainingAttempts }
        : null);
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
          <span className="guardian-login-brand-mark">
            {brand?.logo_url ? <img className="guardian-institution-logo" src={brand.logo_url} alt="" /> : <BookOpen size={28} strokeWidth={1.5} />}
          </span>
          <div>
            <strong>{brand?.name || t.panelTitle}</strong>
            <span>{t.panelTitle}</span>
          </div>
        </div>
        <div className="guardian-login-message">
          <p>{t.learningTogether}</p>
          <h1>{t.loginWelcome}</h1>
          <p>{t.loginDescription}</p>
          <div className="guardian-login-visual" aria-hidden="true">
            <div className="guardian-visual-report">
              <div className="guardian-visual-report-heading">
                <span><GraduationCap size={19} />{t.results}</span>
                <span className="guardian-visual-dots"><i /><i /><i /></span>
              </div>
              <div className="guardian-visual-chart">
                {[32, 51, 42, 68, 57, 79, 94].map((height, index) => (
                  <span key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="guardian-visual-report-lines"><i /><i /><i /></div>
            </div>
            <div className="guardian-visual-attendance">
              <span className="guardian-visual-icon"><CalendarCheck size={21} /></span>
              <div><strong>{t.attendance}</strong><span className="guardian-visual-calendar">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</span></div>
            </div>
            <div className="guardian-visual-notice">
              <span className="guardian-visual-icon"><Megaphone size={20} /></span>
              <div><strong>{t.notices}</strong><span className="guardian-visual-notice-line" /></div>
            </div>
          </div>
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
            <div className="guardian-login-identity">
              <div className="guardian-login-toolbar"><LanguageSwitcher /></div>
              <div className="guardian-login-logo-seal">
                {brand?.logo_url ? <img src={brand.logo_url} alt={brand.name} /> : <GraduationCap size={32} strokeWidth={1.5} />}
              </div>
              <div className="guardian-login-school-details">
                <h1 className="guardian-login-school-name">{brand?.name || t.panelTitle}</h1>
                {brand?.address?.trim() && (
                  <p className="guardian-login-address">
                    <MapPin size={16} strokeWidth={1.6} aria-hidden="true" />
                    <span>{brand.address}</span>
                  </p>
                )}
                <span className="guardian-login-portal-label">{t.panelTitle}</span>
              </div>
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
              noValidate
              onKeyDown={(event) => {
                if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement) || event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (!loading && !cooldown.isBlocked() && !event.repeat) event.currentTarget.requestSubmit();
              }}
              onSubmit={(event) => {
                event.preventDefault();
                void handleLogin();
              }}
              className="guardian-login-form"
            >
              <div className="guardian-login-heading">
                <span className="guardian-login-heading-icon" aria-hidden="true">
                  <LockKeyhole size={19} strokeWidth={1.6} />
                </span>
                <div>
                  <h2>{t.loginTitle}</h2>
                  <p>{t.loginHint}</p>
                </div>
              </div>
              <label className="guardian-login-label" htmlFor="guardian-phone">
                {t.mobileNumber}
              </label>
              <div className="guardian-login-field">
                <Phone className="guardian-login-field-icon" size={18} strokeWidth={1.6} aria-hidden="true" />
                <Input
                  id="guardian-phone"
                  type="tel"
                  enterKeyHint="go"
                  autoComplete="tel"
                  required
                  placeholder={t.mobileNumber}
                  value={phone}
                  invalid={!!errors.phone}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "guardian-phone-error" : undefined}
                  onChange={(e) => { setPhone(e.target.value); setErrors((previous) => ({ ...previous, phone: null })); }}
                  className="dark:border-slate-200 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400 dark:hover:border-slate-300"
                />
              </div>
              {errors.phone && <p id="guardian-phone-error" className="guardian-login-field-error">{errors.phone}</p>}

              <label className="guardian-login-label" htmlFor="guardian-password">
                {t.password}
              </label>
              <div className="guardian-login-field guardian-login-password-field">
                <LockKeyhole className="guardian-login-field-icon" size={18} strokeWidth={1.6} aria-hidden="true" />
                <Input
                  id="guardian-password"
                  autoComplete="current-password"
                  enterKeyHint="go"
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder={t.password}
                  value={password}
                  invalid={!!errors.password}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "guardian-password-error" : undefined}
                  onChange={(e) => { setPassword(e.target.value); setErrors((previous) => ({ ...previous, password: null })); }}
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
              {errors.password && <p id="guardian-password-error" className="guardian-login-field-error">{errors.password}</p>}

              {remainingAttempts !== null && cooldown.remaining === 0 && (
                <p id="guardian-login-attempts" className="guardian-login-attempts" role="status">
                  {loginText.attemptsRemaining(localizeDigits(remainingAttempts, lang))}
                </p>
              )}
              {cooldown.remaining > 0 && (
                <div id="guardian-login-cooldown" className="guardian-login-cooldown">
                  <Timer size={16} aria-hidden="true" />
                  <span role="timer" aria-live="off">{loginText.retryIn(countdown)}</span>
                </div>
              )}
              <Button type="submit" disabled={loading || cooldown.remaining > 0} aria-describedby={cooldown.remaining > 0 ? "guardian-login-cooldown" : remainingAttempts !== null ? "guardian-login-attempts" : undefined} className="guardian-login-submit w-full">
                {loading ? t.loggingIn : t.login}
              </Button>
            </form>
          )}
          {!tenantBlock && (
            <div className="guardian-login-support">
              <p className="guardian-login-help"><KeyRound size={18} aria-hidden="true" /><span>{t.firstLoginHint}</span></p>
              <p className="guardian-login-help"><CircleHelp size={18} aria-hidden="true" /><span>{t.forgotPasswordHint}</span></p>
            </div>
          )}
          {!tenantBlock && <GuardianAppInstall slug={madrasaSlug} />}
        </div>
      </div>
    </div>
  );
}
