export function getLoginRetrySeconds(response: { status?: number; data?: any; headers?: any } | undefined) {
  if (!response || (response.data?.code !== "GUARDIAN_LOGIN_LOCKED" && response.status !== 429)) return 0;
  const seconds = Number(response.data?.retryAfterSeconds ?? response.headers?.["retry-after"]);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  const deadline = Date.parse(response.data?.lockedUntil || response.headers?.["retry-after"] || "");
  return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}

export function remainingLoginSeconds(until: number, now = Date.now()) {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export function formatLoginCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
