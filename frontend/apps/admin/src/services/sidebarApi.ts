import api, { cachedGet } from "./api";

export async function loadSidebar() {
  const res = await cachedGet("/sidebar");
  return res.data;
}

// Bypasses the GET cache so sidebar badge counts (e.g. পেন্ডিং ভর্তি
// অনুমোদন) reflect an action just taken on the current page immediately,
// instead of waiting out cachedGet's TTL.
export async function refreshSidebar() {
  const res = await api.get("/sidebar");
  return res.data;
}
