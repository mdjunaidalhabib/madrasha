import api from "./api";

export async function loadSidebar() {
  const res = await api.get("/sidebar");
  return res.data;
}
