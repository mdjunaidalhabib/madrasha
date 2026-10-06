import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, LogOut, MapPin, Monitor, ShieldOff, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import InlineImageField from "../../../components/settings/InlineImageField";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { getStoragePublicId } from "../../../utils/cloudUpload";
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

type DeviceKind = "phone" | "tablet" | "desktop";

const DEVICE_ICONS: Record<DeviceKind, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

/** Turns a raw User-Agent string into a device label - e.g. "Windows
 * computer", "iPhone", "Android phone (SM-A515F)". Only the device is
 * shown (never the browser), which is what users recognise when deciding
 * which session to end. No full UA-parsing dependency needed. */
function describeDevice(userAgent: string | null): { label: string; kind: DeviceKind } {
  const t = getText(profileText);
  if (!userAgent) return { label: t.unknownDevice, kind: "desktop" };

  if (/iPad/.test(userAgent)) return { label: "iPad", kind: "tablet" };
  if (/iPhone|iPod/.test(userAgent)) return { label: "iPhone", kind: "phone" };

  if (/Android/.test(userAgent)) {
    const kind: DeviceKind = /Mobile/.test(userAgent) ? "phone" : "tablet";
    // Model sits after the Android version, e.g. "Android 13; SM-A515F Build/..".
    // Modern Chrome reduces it to "K", which carries no information.
    const model = userAgent.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/)?.[1]?.trim();
    const base = kind === "phone" ? t.androidPhone : t.androidTablet;
    return { label: model && model !== "K" ? `${base} (${model})` : base, kind };
  }

  if (/CrOS/.test(userAgent)) return { label: "Chromebook", kind: "desktop" };
  if (/Windows/.test(userAgent)) return { label: t.windowsComputer, kind: "desktop" };
  if (/Macintosh|Mac OS X/.test(userAgent)) return { label: "Mac", kind: "desktop" };
  if (/Linux/.test(userAgent)) return { label: t.linuxComputer, kind: "desktop" };

  return { label: t.unknownDevice, kind: "desktop" };
}

/** "Dhaka, Bangladesh · 103.4.145.2" - country name localised via Intl. */
/** Loopback / LAN addresses (::1, 127.x, 192.168.x, ...) have no public
 * location - e.g. the backend running on the same machine or office network. */
const PRIVATE_IP = /^(::1$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:|fe80:)/i;

function describeLocation(session: ActiveSession, lang: Lang): string {
  if (session.ip_address && PRIVATE_IP.test(session.ip_address)) return getText(profileText).localNetwork;

  let country = session.country || "";
  if (country) {
    try {
      country = new Intl.DisplayNames([lang === "bn" ? "bn" : "en"], { type: "region" }).of(country) || country;
    } catch {
      // keep the raw code
    }
  }
  const place = [session.city, country].filter(Boolean).join(", ");
  return [place, session.ip_address].filter(Boolean).join(" · ");
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
    const oldPublicId = getStoragePublicId(profile?.photo_url);
    await patchProfile({ photo_url: value });
    if (oldPublicId && oldPublicId !== getStoragePublicId(value)) {
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
        setSessions((prev) => prev.filter((s) => s.is_current));
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
              {sessions.map((session) => {
                const device = describeDevice(session.device_info);
                const DeviceIcon = DEVICE_ICONS[device.kind];
                return (
                <li
                  key={session.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    session.is_current
                      ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                      : "border-gray-100 dark:border-slate-800"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      session.is_current
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <DeviceIcon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                      <span className="truncate">{device.label}</span>
                      {session.is_current && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          {t.thisDevice}
                        </span>
                      )}
                    </p>
                    {describeLocation(session, lang) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
                        <MapPin size={12} className="shrink-0 text-gray-400 dark:text-slate-500" />
                        <span className="truncate">{describeLocation(session, lang)}</span>
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                      {t.loginAt(formatSessionDate(session.created_at, lang))}
                      {session.is_current ? (
                        <> · <span className="text-emerald-600 dark:text-emerald-400">{t.activeNow}</span></>
                      ) : session.last_active_at ? (
                        <> · {t.lastActive(formatSessionDate(session.last_active_at, lang))}</>
                      ) : null}
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
                );
              })}
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
