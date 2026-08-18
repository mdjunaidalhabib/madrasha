import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { SkeletonCard } from "../../../components/ui/Skeleton";
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
  type MyProfile,
} from "../../../services/profileApi";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import { logger } from "../../../utils/logger";

export default function ProfileSettingsPage() {
  const updateAuthUser = useAuthStore((s) => s.updateUser);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">নতুন পাসওয়ার্ড</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              নতুন পাসওয়ার্ড আবার লিখুন
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
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
    </div>
  );
}
