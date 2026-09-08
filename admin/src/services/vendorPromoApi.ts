import { cachedGet } from "./api";

export type VendorPromoService = {
  id: number;
  label: string;
  desc: string | null;
  icon_key: string;
  is_current: boolean;
};

export type VendorPromoPayload =
  | { enabled: false }
  | {
      enabled: true;
      company_name: string;
      tagline: string;
      teaser_text: string;
      detail_link_text: string;
      hero_title: string;
      hero_text: string;
      founder: {
        name: string;
        title: string;
        location: string | null;
        bio: string | null;
        skills: string[];
        photo_url: string | null;
        facebook_url: string | null;
      };
      contact: {
        phone_display: string;
        phone_intl: string;
        email: string;
        website: string;
        address: string;
      };
      services: VendorPromoService[];
    };

export async function getVendorPromo() {
  const res = await cachedGet("/dashboard/vendor-promo");
  return res.data.data as VendorPromoPayload;
}
