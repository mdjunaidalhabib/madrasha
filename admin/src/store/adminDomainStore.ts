import { create } from "zustand";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";

export type AdminDomain = { slug: string; name: string; logo: string | null };
export const useAdminDomainStore = create<{ institution: AdminDomain | null }>(() => ({
  institution: null,
}));

export async function resolveAdminDomain() {
  const response = await fetch(`${API_BASE_URL}/website/resolve-admin-domain`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Domain lookup failed");
  const { data } = await response.json();
  if (data !== null && (!data?.slug || !data?.name)) throw new Error("Invalid domain response");
  useAdminDomainStore.setState({ institution: data });
  return data as AdminDomain | null;
}
