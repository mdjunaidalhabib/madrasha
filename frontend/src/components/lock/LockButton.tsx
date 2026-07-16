import { useUIStore } from "../../store/uiStore";
import Button from "../ui/Button";
import { LockKeyhole } from "lucide-react";

export default function LockButton() {
  const lock = useUIStore((s) => s.lock);

  return (
    <Button
      variant="secondary"
      onClick={lock}
      className="flex items-center justify-center gap-1 px-1 py-1 md:px-3 md:py-2"
    >
      <LockKeyhole size={18} />

      {/* Desktop text */}
      <span className="hidden md:inline">Lock</span>
    </Button>
  );
}
