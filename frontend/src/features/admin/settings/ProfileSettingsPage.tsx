import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Laptop, LogOut, ShieldOff } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import Modal from "../../../components/ui/Modal";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import InlineImageField from "../../../components/settings/InlineImageField";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { getCloudinaryPublicId } from "../../../utils/cloudUpload";
import { uploadApi } from "../../../services/phase4Api";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  logoutAllDevices,
  revokeSession,
  getActiveSessions,
  type MyProfile,
  type ActiveSession,
} from "../../../services/profileApi";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import { logger } from "../../../utils/logger";
import { getTenantAdminBase } from "../../../utils/tenantSlug";

/** Turns a raw User-Agent string into a short, human-readable label - e.g.
 * "Chrome, Windows" - good enough for telling devices apart in the
 * logout-all modal without pulling in a full UA-parsing dependency. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "অজানা ডিভাইস";

  const browser =
    (/Edg\//.test(userAgent) && "Edge") ||
    (/OPR\//.test(userAgent) && "Opera") ||
    (/Chrome\//.test(userAgent) && "Chrome") ||
    (/CriOS\//.test(userAgent) && "Chrome") ||
    (/Firefox\//.test(userAgent) && "Firefox") ||
    (/Safari\//.test(userAgent) && "Safari") ||
    "ব্রাউজার";

  const os =
    (/Windows/.test(userAgent) && "Windows") ||
    (/Android/.test(userAgent) && "Android") ||
    (/iPhone|iPad|iPod/.test(userAgent) && "iOS") ||
    (/Mac OS X/.test(userAgent) && "macOS") ||
    (/Linux/.test(userAgent) && "Linux") ||
    "";

  return os ? `${browser}, ${os}` : browser;
}

function formatSessionDate(value: string): string {
  try {
    return new Date(value).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export default function ProfileSettingsPage() {
  const updateAuthUser = useAuthStore((s) => s.updateUser);
  const authLogout = useAuthStore((s) => s.logout);
  const nav = useNavigate();
  const { madrasaSlug = "" } = useParams();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  // Confirm modal for the two "logout everywhere" variants - null = closed,
  // "all" = including this device, "others" = every device except this one.
  const [logoutAllMode, setLogoutAllMode] = useState<"all" | "others" | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

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
      useToastStore.getState().show("সেশন তালিকা লোড করা যায়নি।", "error");
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
        useToastStore.getState().show("প্রোফাইল লোড করা যায়নি।", "error");
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
      useToastStore.getState().show("সংরক্ষণ হয়েছে।", "success");
    } catch {
      useToastStore.getState().show("সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।", "error");
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
      useToastStore.getState().show("বর্তমান ও নতুন পাসওয়ার্ড দিন।", "error");
      return;
    }
    if (newPassword.length < 6) {
      useToastStore.getState().show("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      useToastStore.getState().show("নতুন পাসওয়ার্ড দুইবার একই দিতে হবে।", "error");
      return;
    }
    setChangingPassword(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      useToastStore.getState().show("পাসওয়ার্ড পরিবর্তন হয়েছে।", "success");
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || "পাসওয়ার্ড পরিবর্তন করা যায়নি।", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRevokeSession = async (session: ActiveSession) => {
    setRevokingSessionId(session.id);
    try {
      await revokeSession(session.id);
      if (session.is_current) {
        // Ended our own session - the access token still works for a few
        // minutes, but there's no refresh token left to renew it with, so
        // just sign out locally right away instead of waiting for a 401.
        useToastStore.getState().show("লগআউট করা হয়েছে।", "success");
        authLogout();
        nav(`${getTenantAdminBase(madrasaSlug)}/login`);
        return;
      }
      useToastStore.getState().show("সেশনটি লগআউট করা হয়েছে।", "success");
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch {
      useToastStore.getState().show("লগআউট করা যায়নি। আবার চেষ্টা করুন।", "error");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const confirmLogoutAllDevices = async () => {
    const keepCurrent = logoutAllMode === "others";
    setLoggingOutAll(true);
    try {
      await logoutAllDevices(keepCurrent);
      setLogoutAllMode(null);
      if (keepCurrent) {
        useToastStore.getState().show("অন্য সব ডিভাইস থেকে লগআউট করা হয়েছে।", "success");
        loadSessions();
        return;
      }
      useToastStore.getState().show("সব ডিভাইস থেকে লগআউট করা হয়েছে।", "success");
      authLogout();
      nav(`${getTenantAdminBase(madrasaSlug)}/login`);
    } catch {
      useToastStore.getState().show("লগআউট করা যায়নি। আবার চেষ্টা করুন।", "error");
    } finally {
      setLoggingOutAll(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="প্রোফাইল সেটিংস" />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="প্রোফাইল সেটিংস"
        subtitle="আপনার নিজের নাম, মোবাইল নম্বর, ছবি ও পাসওয়ার্ড এখান থেকে আপডেট করুন।"
      />

      <SectionCard title="প্রোফাইল ছবি">
        <InlineImageField
          label="ছবি"
          value={profile.photo_url}
          folder="profile"
          onSave={savePhoto}
        />
      </SectionCard>

      <SectionCard
        title="মূল তথ্য"
        hint="তথ্যের পাশের পেন্সিল আইকনে ক্লিক করলে শুধু সেই ফিল্ডটি এডিট করা যাবে"
      >
        <div className="space-y-2">
          <InlineTextField
            label="নাম"
            value={profile.name}
            required
            onSave={(v) => patchProfile({ name: v })}
          />
          <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">ইমেইল</p>
              <p className="mt-0.5 text-sm text-gray-900 dark:text-slate-100">{profile.email}</p>
            </div>
          </div>
          <InlineTextField
            label="মোবাইল নম্বর"
            value={profile.mobile || ""}
            placeholder="যেমন: 01xxxxxxxxx"
            onSave={(v) => patchProfile({ mobile: v })}
          />
          <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">রোল</p>
              <p className="mt-0.5 text-sm text-gray-900 dark:text-slate-100">
                {profile.role_label || profile.role_key}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="পাসওয়ার্ড পরিবর্তন"
        hint="নিরাপত্তার জন্য বর্তমান পাসওয়ার্ড দিয়ে যাচাই করা হবে"
      >
        <div className="max-w-sm space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              বর্তমান পাসওয়ার্ড
            </label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showCurrentPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">নতুন পাসওয়ার্ড</label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showNewPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              নতুন পাসওয়ার্ড আবার লিখুন
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showConfirmPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
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
            {changingPassword ? "পরিবর্তন হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন করুন"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="লগইন সেশন"
        hint="আপনি বর্তমানে যেসব ডিভাইস/ব্রাউজার থেকে লগইন করা আছেন, তার তালিকা"
      >
        <div className="space-y-4">
          {loadingSessions ? (
            <SkeletonCard lines={3} />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">কোনো সক্রিয় সেশন পাওয়া যায়নি।</p>
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
                          এই ডিভাইস
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                      লগইন: {formatSessionDate(session.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revokingSessionId === session.id}
                    onClick={() => handleRevokeSession(session)}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    <LogOut size={13} />
                    {revokingSessionId === session.id ? "..." : "লগআউট"}
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
              onClick={() => setLogoutAllMode("others")}
            >
              <ShieldOff size={14} />
              অন্য সব ডিভাইস থেকে লগআউট করুন
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex items-center gap-1.5"
              onClick={() => setLogoutAllMode("all")}
            >
              <ShieldOff size={14} />
              এই ডিভাইসসহ সব ডিভাইস থেকে লগআউট করুন
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={logoutAllMode !== null}
        title={logoutAllMode === "others" ? "অন্য সব ডিভাইস থেকে লগআউট" : "সব ডিভাইস থেকে লগআউট"}
        onClose={() => !loggingOutAll && setLogoutAllMode(null)}
        maxWidthClassName="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {logoutAllMode === "others"
              ? "এই ডিভাইস ছাড়া বাকি সব ডিভাইস/ব্রাউজার থেকে লগআউট হয়ে যাবে। আপনি এখানে লগইন করা থাকবেন। এগিয়ে যাবেন?"
              : "আপনি লগইন করা আছেন এমন সব ডিভাইস থেকে (এই ডিভাইসসহ) লগআউট হয়ে যাবেন। এগিয়ে যাবেন?"}
          </p>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={loggingOutAll}
              onClick={() => setLogoutAllMode(null)}
            >
              বাতিল
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex items-center gap-1.5"
              disabled={loggingOutAll}
              onClick={confirmLogoutAllDevices}
            >
              <ShieldOff size={14} />
              {loggingOutAll ? "লগআউট হচ্ছে..." : "নিশ্চিত করুন"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
