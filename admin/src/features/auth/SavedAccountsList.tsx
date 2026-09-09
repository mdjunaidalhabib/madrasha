import { useState } from "react";
import { X } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { getSavedAccounts, removeSavedAccount, type SavedAccount } from "../../services/savedAccounts";

/** Small circular avatar for a saved account - its photo when there is one,
 * otherwise a letter badge (Facebook-style). */
export function AccountAvatar({ account }: { account: SavedAccount }) {
  if (account.photoUrl) {
    return (
      <img
        src={account.photoUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    );
  }
  const letter = (account.name || account.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
      {letter}
    </div>
  );
}

const madrasaLabel = (account: SavedAccount) => account.madrasaName || account.madrasaCode;

type SavedAccountsListProps = {
  accounts: SavedAccount[];
  onAccountsChange: (accounts: SavedAccount[]) => void;
  /** When given, each row is clickable (the login page's "pick this
   * account" flow). Omitted on the profile settings page, which only
   * manages the list rather than logging in with it. */
  onSelect?: (account: SavedAccount) => void;
};

/** The saved-device login list, shared by the login page's account switcher
 * and the profile settings page's "সংরক্ষিত লগইন" management section - same
 * data (services/savedAccounts.ts, this browser's localStorage), same
 * confirm-before-remove behavior, two different call sites. */
export default function SavedAccountsList({
  accounts,
  onAccountsChange,
  onSelect,
}: SavedAccountsListProps) {
  const [pendingRemove, setPendingRemove] = useState<SavedAccount | null>(null);

  const confirmRemove = () => {
    if (!pendingRemove) return;
    removeSavedAccount(pendingRemove.madrasaSlug, pendingRemove.email);
    onAccountsChange(getSavedAccounts());
    setPendingRemove(null);
  };

  return (
    <>
      <ul className="space-y-1.5">
        {accounts.map((account) => (
          <li
            key={`${account.madrasaSlug}|${account.email}`}
            className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-slate-800"
          >
            <div
              className={`flex min-w-0 flex-1 items-center gap-3 ${onSelect ? "cursor-pointer" : ""}`}
              {...(onSelect
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    onClick: () => onSelect(account),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") onSelect(account);
                    },
                  }
                : {})}
            >
              <AccountAvatar account={account} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                  {madrasaLabel(account)}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                  {account.name} · {account.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingRemove(account)}
              className="shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-rose-600 dark:hover:bg-slate-800"
              aria-label="সংরক্ষিত তালিকা থেকে সরান"
              title="সংরক্ষিত তালিকা থেকে সরান"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={pendingRemove !== null}
        title="সংরক্ষিত লগইন সরাবেন?"
        onClose={() => setPendingRemove(null)}
        maxWidthClassName="max-w-sm"
      >
        {pendingRemove && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              <span className="font-medium text-gray-900 dark:text-slate-100">
                {pendingRemove.name}
              </span>{" "}
              ({madrasaLabel(pendingRemove)}) এই ডিভাইসের সংরক্ষিত লগইন তালিকা থেকে সরে যাবে। পরের বার
              এই অ্যাকাউন্টে লগইন করতে আবার মাদরাসা কোড ও ইমেইল দিতে হবে।
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPendingRemove(null)}>
                বাতিল
              </Button>
              <Button type="button" variant="danger" onClick={confirmRemove}>
                সরিয়ে দিন
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
