import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Laptop, LogOut, ShieldOff } from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import InlineImageField from "../../../components/settings/InlineImageField";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { getCloudinaryPublicId } from "../../../utils/cloudUpload";
import { uploadApi } from "../../../services/phase4Api";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  verifyMyPassword,
  logoutAllDevices,
  revokeSession,
  getActiveSessions,
  type MyProfile,
  type ActiveSession,
} from "../../../services/profileApi";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { commonText, formatDateTime, getText, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { profileText } from "./settingsPages.text";
import { servicesText } from "../../../services/services.text";

/** Turns a raw User-Agent string into a short, human-readable label - e.g.
 * "Chrome, Windows" - good enough for telling devices apart in the
 * logout-all modal without pulling in a full UA-parsing dependency. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return getText(profileText).unknownDevice;

  const browser =
    (/Edg\//.test(userAgent) && "Edge") ||
    (/OPR\//.test(userAgent) && "Opera") ||
    (/Chrome\//.test(userAgent) && "Chrome") ||
    (/CriOS\//.test(userAgent) && "Chrome") ||
    (/Firefox\//.test(userAgent) && "Firefox") ||
    (/Safari\//.test(userAgent) && "Safari") ||
    getText(profileText).browser;

  const os =
    (/Windows/.test(userAgent) && "Windows") ||
    (/Android/.test(userAgent) && "Android") ||
    (/iPhone|iPad|iPod/.test(userAgent) && "iOS") ||
    (/Mac OS X/.test(userAgent) && "macOS") ||
    (/Linux/.test(userAgent) && "Linux") ||
    "";

  return os ? `${browser}, ${os}` : browser;
}

function formatSessionDate(value: string, lang: Lang): string {
  try {
    return formatDateTime(value, lang, { dateStyle: "medium", timeStyle: "short" }) || value;
  } catch {
    return value;
  }
}

export default function ProfileSettingsPage() {
  const updateAuthUser = useAuthStore((s) => s.updateUser);
  const authLogout = useAuthStore((s) => s.logout);
  const nav = useNavigate();
  const t = useText(profileText);
  const c = useText(commonText);
  const lang = useLang();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Every "logout a session" action (one device, other devices, or all
  // devices) goes through the same two-step modal: step 1 re-verifies the
  // user's password, step 2 is a plain "are you sure?" before it actually
  // happens - two separate confirmations since this can sign the user out
  // of devices they're not looking at right now.
  type LogoutTarget = { kind: "session"; session: ActiveSession } | { kind: "others" } | { kind: "all" };
  const [logoutTarget, setLogoutTarget] = useState<LogoutTarget | null>(null);
  const [logoutStep, setLogoutStep] = useState<1 | 2>(1);
  const [logoutPassword, setLogoutPassword] = useState("");
  const [showLogoutPassword, setShowLogoutPassword] = useState(false);
  const [verifyingLogoutPassword, setVerifyingLogoutPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const closeLogoutModal = () => {
    if (verifyingLogoutPassword || loggingOut) return;
    setLogoutTarget(null);
    setLogoutStep(1);
    setLogoutPassword("");
    setShowLogoutPassword(false);
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await getActiveSessions();
      setSessions(data);
    } catch {
      useToastStore.getState().show(t.sessionsLoadFailed, "error");
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getMyProfile();
        setProfile(data);
      } catch {
        useToastStore.getState().show(t.profileLoadFailed, "error");
      } finally {
        setLoading(false);
      }
    })();
    loadSessions();
  }, []);

  const patchProfile = async (patch: { name?: string; mobile?: string; photo_url?: string }) => {
    try {
      await updateMyProfile(patch);
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      updateAuthUser({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.mobile !== undefined ? { mobile: patch.mobile || null } : {}),
        ...(patch.photo_url !== undefined ? { photo_url: patch.photo_url || null } : {}),
      });
      useToastStore.getState().show(getText(servicesText).savedDot, "success");
    } catch {
      useToastStore.getState().show(getText(servicesText).saveFailedRetry, "error");
      throw new Error("save failed");
    }
  };

  const savePhoto = async (value: string) => {
    const oldPublicId = getCloudinaryPublicId(profile?.photo_url);
    await patchProfile({ photo_url: value });
    if (oldPublicId && oldPublicId !== getCloudinaryPublicId(value)) {
      uploadApi
        .deleteImage(oldPublicId)
        .catch((err) => logger.error("OLD PROFILE PHOTO CLEANUP ERROR:", err));
    }
  };

  const submitPasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      useToastStore.getState().show(t.enterBothPasswords, "error");
      return;
    }
    if (newPassword.length < 6) {
      useToastStore.getState().show(t.newPasswordMin6, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      useToastStore.getState().show(t.newPasswordMismatch, "error");
      return;
    }
    setChangingPassword(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      useToastStore.getState().show(t.passwordChanged, "success");
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || t.passwordChangeFailed, "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmLogout = async () => {
    if (!logoutTarget) return;
    if (!logoutPassword) {
      useToastStore.getState().show(t.enterPassword, "error");
      return;
    }
    setVerifyingLogoutPassword(true);
    try {
      await verifyMyPassword(logoutPassword);
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || t.wrongPassword, "error");
      setVerifyingLogoutPassword(false);
      return;
    }
    setVerifyingLogoutPassword(false);

    setLoggingOut(true);
    try {
      if (logoutTarget.kind === "session") {
        const session = logoutTarget.session;
        await revokeSession(session.id);
        if (session.is_current) {
          // Ended our own session - the access token still works for a few
          // minutes, but there's no refresh token left to renew it with, so
          // just sign out locally right away instead of waiting for a 401.
          useToastStore.getState().show(t.loggedOut, "success");
          closeLogoutModal();
          authLogout();
          nav(`/login`);
          return;
        }
        useToastStore.getState().show(t.sessionLoggedOut, "success");
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
        closeLogoutModal();
        return;
      }

      const keepCurrent = logoutTarget.kind === "others";
      await logoutAllDevices(keepCurrent);
      closeLogoutModal();
      if (keepCurrent) {
        useToastStore.getState().show(t.loggedOutOthers, "success");
        loadSessions();
        return;
      }
      useToastStore.getState().show(t.loggedOutAll, "success");
      authLogout();
      nav(`/login`);
    } catch {
      useToastStore.getState().show(t.logoutFailed, "error");
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={t.title} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
      />

      <SectionCard title={t.profilePhoto}>
        <InlineImageField
          label={c.photo}
          value={profile.photo_url}
          folder="profile"
          onSave={savePhoto}
        />
      </SectionCard>

      <SectionCard
        title={t.basicInfo}
        hint={t.basicInfoHint}
      >
        <div className="space-y-2">
          <InlineTextField
            label={c.name}
            value={profile.name}
            required
            onSave={(v) => patchProfile({ name: v })}
          />
          <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{c.email}</p>
              <p className="mt-0.5 text-sm text-gray-900 dark:text-slate-100">{profile.email}</p>
            </div>
          </div>
          <InlineTextField
            label={t.mobileNumber}
            value={profile.mobile || ""}
            placeholder={t.mobilePlaceholder}
            onSave={(v) => patchProfile({ mobile: v })}
          />
          <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{t.role}</p>
              <p className="mt-0.5 text-sm text-gray-900 dark:text-slate-100">
                {profile.role_label || profile.role_key}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t.changePassword}
        hint={t.changePasswordHint}
      >
        <div className="max-w-sm space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              {t.currentPassword}
            </label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showCurrentPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">{t.newPassword}</label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showNewPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              {t.retypeNewPassword}
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showConfirmPassword ? t.hidePassword : t.showPassword}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <Button
            type="button"
            className="flex items-center gap-1.5"
            disabled={changingPassword}
            onClick={submitPasswordChange}
          >
            <KeyRound size={14} />
            {changingPassword ? t.changing : t.changePasswordBtn}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title={t.loginSessions}
        hint={t.loginSessionsHint}
      >
        <div className="space-y-4">
          {loadingSessions ? (
            <SkeletonCard lines={3} />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">{t.noSessions}</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-slate-800"
                >
                  <Laptop size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                      {describeDevice(session.device_info)}
                      {session.is_current && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          {t.thisDevice}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                      {t.loginAt(formatSessionDate(session.created_at, lang))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogoutTarget({ kind: "session", session })}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    <LogOut size={13} />
                    {c.logout}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              className="flex items-center gap-1.5"
              disabled={sessions.length < 2}
              onClick={() => setLogoutTarget({ kind: "others" })}
            >
              <ShieldOff size={14} />
              {t.logoutOthers}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex items-center gap-1.5"
              onClick={() => setLogoutTarget({ kind: "all" })}
            >
              <ShieldOff size={14} />
              {t.logoutAllIncluding}
            </Button>
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500">
            {t.takesUpTo15}
          </p>
        </div>
      </SectionCard>

      <Modal
        open={logoutTarget !== null}
        title={
          logoutTarget?.kind === "session"
            ? t.sessionLogout
            : logoutTarget?.kind === "others"
              ? t.othersLogout
              : t.allLogout
        }
        onClose={closeLogoutModal}
        maxWidthClassName="max-w-sm"
      >
        {logoutStep === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {logoutTarget?.kind === "session"
                ? logoutTarget.session.is_current
                  ? t.confirmSelf
                  : t.confirmDevice
                : logoutTarget?.kind === "others"
                  ? t.confirmOthers
                  : t.confirmAll}
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeLogoutModal}>
                {c.cancel}
              </Button>
              <Button type="button" variant="danger" onClick={() => setLogoutStep(2)}>
                {c.next}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t.confirmPasswordHint}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
                {t.password}
              </label>
              <div className="relative">
                <Input
                  type={showLogoutPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={logoutPassword}
                  onChange={(e) => setLogoutPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmLogout()}
                  className="pe-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowLogoutPassword((v) => !v)}
                  className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label={showLogoutPassword ? t.hidePassword : t.showPassword}
                  tabIndex={-1}
                >
                  {showLogoutPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={verifyingLogoutPassword || loggingOut}
                onClick={() => setLogoutStep(1)}
              >
                {c.back}
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex items-center gap-1.5"
                disabled={verifyingLogoutPassword || loggingOut}
                onClick={confirmLogout}
              >
                <ShieldOff size={14} />
                {verifyingLogoutPassword ? t.verifying : loggingOut ? t.loggingOut : c.confirm}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
