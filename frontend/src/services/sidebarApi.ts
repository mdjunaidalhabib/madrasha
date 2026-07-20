import api, { cachedGet } from "./api";

export async function loadSidebar() {
  const res = await cachedGet("/sidebar");
  return res.data;
}
