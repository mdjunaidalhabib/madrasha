import { useEffect, useState } from "react";
import { getCachedPublicBrand, getPublicBrand, type PublicBrand } from "../../services/publicWebsiteApi";

export function useGuardianBrand(slug: string) {
  const [brand, setBrand] = useState<PublicBrand | null>(() => getCachedPublicBrand(slug));
  useEffect(() => {
    let cancelled = false;
    setBrand(getCachedPublicBrand(slug));
    if (slug) {
      void getPublicBrand(slug).then((data) => {
        if (!cancelled) setBrand(data);
      }).catch(() => { if (!cancelled) setBrand(null); });
    }
    return () => { cancelled = true; };
  }, [slug]);
  return brand?.slug === slug ? brand : getCachedPublicBrand(slug);
}
