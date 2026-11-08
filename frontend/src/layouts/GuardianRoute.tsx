import GuardianAuthGuard from "../components/guards/GuardianAuthGuard";
import GuardianLayout from "./GuardianLayout";

// Keep guardian authentication and navigation out of the marketing entry bundle.
export default function GuardianRoute() {
  return (
    <GuardianAuthGuard>
      <GuardianLayout />
    </GuardianAuthGuard>
  );
}
