import {
  Building2,
  Camera,
  Globe,
  GraduationCap,
  LayoutTemplate,
  Megaphone,
  MessageSquareText,
  Rocket,
  Server,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// Fixed, small icon set for vendor services - editable from Super Admin via
// a <select> of these keys (see SuperAdminVendorPromoPage.tsx), rendered
// here via a plain lookup rather than dynamic lucide imports so an
// unrecognized/removed key never crashes the page (falls back to Sparkles).
export const VENDOR_ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap,
  ShoppingBag,
  Building2,
  LayoutTemplate,
  Rocket,
  Server,
  Globe,
  Wallet,
  MessageSquareText,
  Smartphone,
  Camera,
  Megaphone,
  Sparkles,
};

export const VENDOR_ICON_KEYS = Object.keys(VENDOR_ICON_MAP);

export function VendorIcon({
  iconKey,
  className,
  strokeWidth = 1.75,
}: {
  iconKey: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = VENDOR_ICON_MAP[iconKey] || Sparkles;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
