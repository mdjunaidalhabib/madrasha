import adminApi from "./adminApi";

export async function updateMadrasaWebsiteStatus(
  id: number,
  status: "active" | "limited" | "disabled",
) {
  const res = await adminApi.patch(`/website/super/madrasas/${id}/status`, { status });
  return res.data;
}
