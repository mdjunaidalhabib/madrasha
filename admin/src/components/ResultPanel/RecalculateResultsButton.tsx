import { useState } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import RecalculateResultsModal from "./RecalculateResultsModal";
import { RESULT_PERMISSIONS } from "./resultStatus";

/** "🔄 ফলাফল পুনঃগণনা" button + its review dialog, for screens that change
 * something the grading engine reads (fail mark, grade bands) and so can
 * leave already-processed results stale. Renders nothing for a user who
 * couldn't run the recalculation anyway (the backend needs result.process /
 * result.manage; তালিমাত always has them). */
export default function RecalculateResultsButton({
  label = "🔄 ফলাফল পুনঃগণনা",
  className = "",
  onApplied,
}: {
  label?: string;
  className?: string;
  onApplied?: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const [open, setOpen] = useState(false);

  const allowed =
    hasPermission(user, permissions, RESULT_PERMISSIONS.resultProcess) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);
  if (!allowed) return null;

  return (
    <>
      <Button variant="secondary" className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <RecalculateResultsModal open={open} onClose={() => setOpen(false)} onApplied={onApplied} />
    </>
  );
}
