import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api, { TENANT_BLOCK_STORAGE_KEY } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useForceLightTheme } from "@madrasha/shared-ui/src/hooks/useForceLightTheme";
import TenantBlockedScreen, {
  type TenantBlockInfo,
} from "@madrasha/shared-ui/src/components/ui/TenantBlockedScreen";
import { getSavedAccounts, upsertSavedAccount, type SavedAccount } from "../../services/savedAccounts";
import SavedAccountsList, { AccountAvatar } from "./SavedAccountsList";
import { LanguageSwitcher, useText } from "@madrasha/shared-ui/src/i18n";
import { authText } from "./auth.text";

function readTenantBlockFromResponse(err: any): TenantBlockInfo | null {
  const status = err?.response?.status;
  if (status !== 410 && status !== 423) return null;
  return { status, message: err?.response?.data?.message };
}

export default function LoginPage() {
  useForceLightTheme();

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  // Which saved account is picked for the password-only quick login -
  // null means "show the full manual form" (new device / new madrasa).
  const [activeAccount, setActiveAccount] = useState<SavedAccount | null>(null);
  // Manual-form mode is shown either when there are no saved accounts yet,
  // or the user explicitly chose "অন্য মাদরাসা/ইমেইল দিয়ে লগইন করুন".
  const [showManualForm, setShowManualForm] = useState(false);

  const [madrasaCode, setMadrasaCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Only start showing red borders on empty fields after a submit attempt -
  // not immediately on page load before the user has typed anything.
  const [attempted, setAttempted] = useState(false);
  // Set either when a login attempt itself fails with 410/423 (madrasa
  // suspended/deleted), or on mount when api.ts's response interceptor
  // redirected here after that happened mid-session (see
  // TENANT_BLOCK_STORAGE_KEY). While set, the login form is replaced
  // entirely by TenantBlockedScreen - retrying login against a
  // suspended/deleted tenant can't succeed, so there's no reason to leave
  // the inputs usable.
  const [tenantBlock, setTenantBlock] = useState<TenantBlockInfo | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);
  const toast = useToastStore();
  const nav = useNavigate();
  const t = useText(authText);

  useEffect(() => {
    setSavedAccounts(getSavedAccounts());

    try {
      const stashed = window.sessionStorage.getItem(TENANT_BLOCK_STORAGE_KEY);
      if (stashed) {
        window.sessionStorage.removeItem(TENANT_BLOCK_STORAGE_KEY);
        setTenantBlock(JSON.parse(stashed));
      }
    } catch {
      // ignore storage/parse errors (e.g. private browsing mode)
    }
  }, []);

  const hasSavedAccounts = savedAccounts.length > 0;
  const showingList = hasSavedAccounts && !showManualForm && !activeAccount;

  const isFilled = !!madrasaCode.trim() && !!email.trim() && !!password;

  const doLogin = async (
    slug: string,
    loginEmail: string,
    loginPassword: string,
    displayCode: string,
  ) => {
    const res = await api.post(
      "/auth/login",
      { email: loginEmail, password: loginPassword },
      { headers: { "X-Madrasa-Slug": slug } },
    );
    setAuth({ ...res.data, madrasaSlug: slug });

    // Remember this device: save (or refresh) this madrasa+email so next
    // time it shows up in the switcher and only needs a password.
    upsertSavedAccount({
      madrasaSlug: slug,
      madrasaCode: displayCode || slug,
      madrasaName: res.data?.madrasa_name || null,
      email: loginEmail,
      name: res.data?.user?.name || loginEmail,
      photoUrl: res.data?.user?.photo_url || null,
      roleLabel: res.data?.user?.role_label || null,
    });

    toast.push("success", t.loggedIn);
    nav("/dashboard");
  };

  const handleManualLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!isFilled) {
      setAttempted(true);
      return;
    }
    setLoading(true);
    try {
      const trimmedCode = madrasaCode.trim();
      await doLogin(trimmedCode.toLowerCase(), email.trim(), password, trimmedCode);
    } catch (err) {
      const block = readTenantBlockFromResponse(err);
      if (block) setTenantBlock(block);
      // Otherwise no local toast here — the global api.ts response
      // interceptor already shows the exact error from the server (e.g.
      // wrong password). Showing it again here was producing two identical
      // toasts per failed login.
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !activeAccount) return;
    if (!password) {
      setAttempted(true);
      return;
    }
    setLoading(true);
    try {
      await doLogin(
        activeAccount.madrasaSlug,
        activeAccount.email,
        password,
        activeAccount.madrasaCode,
      );
    } catch (err) {
      const block = readTenantBlockFromResponse(err);
      if (block) setTenantBlock(block);
      // see handleManualLogin
    } finally {
      setLoading(false);
    }
  };

  const openManualForm = () => {
    setActiveAccount(null);
    setShowManualForm(true);
    setMadrasaCode("");
    setEmail("");
    setPassword("");
    setAttempted(false);
    setTenantBlock(null);
  };

  const pickAccount = (account: SavedAccount) => {
    setActiveAccount(account);
    setPassword("");
    setAttempted(false);
    setTenantBlock(null);
  };

  const backToList = () => {
    setActiveAccount(null);
    setShowManualForm(false);
    setPassword("");
    setTenantBlock(null);
  };

  return (
    <div className="relative flex h-screen items-center justify-center bg-gray-100 p-4">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm rounded bg-white p-6 shadow space-y-4">
        {!tenantBlock && <h2 className="text-xl font-bold">{t.loginTitle}</h2>}

        {tenantBlock && (
          <TenantBlockedScreen
            status={tenantBlock.status}
            message={tenantBlock.message}
            onBack={openManualForm}
          />
        )}

        {!tenantBlock && showingList && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t.pickSavedAccount}</p>

            <SavedAccountsList
              accounts={savedAccounts}
              onAccountsChange={setSavedAccounts}
              onSelect={pickAccount}
            />

            <button
              type="button"
              onClick={openManualForm}
              className="w-full text-center text-xs text-blue-600 hover:underline"
            >
              {t.loginWithOther}
            </button>
          </div>
        )}

        {!tenantBlock && !showingList && activeAccount && (
          <form onSubmit={handleQuickLogin} className="space-y-4">
            <button
              type="button"
              onClick={backToList}
              className="text-xs text-blue-600 hover:underline"
            >
              <span className="inline-block rtl:-scale-x-100">←</span> {t.otherAccount}
            </button>

            <div className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
              <AccountAvatar account={activeAccount} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {activeAccount.madrasaName || activeAccount.madrasaCode}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {activeAccount.name} · {activeAccount.email}
                </p>
              </div>
            </div>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t.password}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-10"
                invalid={attempted && !password}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Button type="submit" disabled={loading || !password} className="w-full">
              {loading ? t.loggingIn : t.login}
            </Button>

            <button
              type="button"
              onClick={() => nav("/forgot-password")}
              className="w-full text-center text-xs text-blue-600 hover:underline"
            >
              {t.forgotPassword}
            </button>
          </form>
        )}

        {!tenantBlock && !showingList && !activeAccount && (
          <form onSubmit={handleManualLogin} className="space-y-4">
            {hasSavedAccounts && (
              <button
                type="button"
                onClick={backToList}
                className="text-xs text-blue-600 hover:underline"
              >
                <span className="inline-block rtl:-scale-x-100">←</span> {t.savedAccountList}
              </button>
            )}

            <Input
              type="text"
              autoComplete="organization"
              placeholder={t.institutionCode}
              value={madrasaCode}
              onChange={(e) => setMadrasaCode(e.target.value)}
              invalid={attempted && !madrasaCode.trim()}
            />

            <Input
              type="email"
              autoComplete="username"
              placeholder={t.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={attempted && !email.trim()}
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-10"
                invalid={attempted && !password}
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Button type="submit" disabled={loading || !isFilled} className="w-full">
              {loading ? t.loggingIn : t.login}
            </Button>

            <button
              type="button"
              onClick={() => nav("/forgot-password")}
              className="w-full text-center text-xs text-blue-600 hover:underline"
            >
              {t.forgotPassword}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
