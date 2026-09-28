import { Ban, Clock3, ArrowLeft } from "lucide-react";
import { useText } from "../../i18n";
import { uiText } from "./ui.text";

export type TenantBlockStatus = 410 | 423;

export interface TenantBlockInfo {
  status: TenantBlockStatus;
  message?: string;
}

interface TenantBlockedScreenProps extends TenantBlockInfo {
  onBack?: () => void;
  backLabel?: string;
}

/**
 * Shown in place of a login form (or in place of an already-authenticated
 * dashboard, after redirecting back to login) when the backend's
 * tenantMiddleware rejects a request with 410 (madrasa deleted) or 423
 * (madrasa suspended). Shared between the admin panel and the guardian
 * portal so both present the same clear, non-retryable block screen instead
 * of a toast the user could just dismiss and keep hammering login/requests.
 */
export default function TenantBlockedScreen({
  status,
  message,
  onBack,
  backLabel,
}: TenantBlockedScreenProps) {
  const t = useText(uiText);
  const isDeleted = status === 410;
  const Icon = isDeleted ? Ban : Clock3;
  const heading = isDeleted ? t.tenantDeletedHeading : t.tenantSuspendedHeading;
  const explanation = isDeleted ? t.tenantDeletedText : t.tenantSuspendedText;
  const badgeColor = isDeleted ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600";

  return (
    <div className="space-y-5 py-2 text-center" role="alert">
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${badgeColor}`}>
        <Icon size={28} />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-gray-900">{heading}</h2>
        {message && <p className="text-sm font-medium text-gray-700">{message}</p>}
        <p className="text-sm leading-relaxed text-gray-500">{explanation}</p>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {backLabel || t.loginWithOther}
        </button>
      )}
    </div>
  );
}
