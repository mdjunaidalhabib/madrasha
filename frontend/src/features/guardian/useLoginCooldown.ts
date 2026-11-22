import { useEffect, useState } from "react";
import { remainingLoginSeconds } from "./loginCooldown";

type Cooldown = { key: string; until: number; duration: number };
const read = (key: string): Cooldown => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved?.until > Date.now() && Number.isFinite(saved.until) && saved.duration > 0) return { key, until: saved.until, duration: saved.duration };
  } catch { /* Storage is optional. */ }
  return { key, until: 0, duration: 0 };
};

export function useLoginCooldown(slug: string) {
  const key = `ems:guardian-login-cooldown:${slug}`;
  const [cooldown, setCooldown] = useState(() => read(key));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setCooldown(read(key));
    setNow(Date.now());
    const update = () => setNow(Date.now());
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) { setCooldown(read(key)); update(); } };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", update);
    };
  }, [key]);
  useEffect(() => {
    if (cooldown.key !== key || cooldown.until <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldown.until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [key, cooldown.key, cooldown.until]);
  const active = cooldown.key === key ? cooldown : read(key);
  const remaining = remainingLoginSeconds(active.until, now);
  const start = (seconds: number) => {
    if (seconds <= 0) return;
    const next = { key, until: Date.now() + seconds * 1000, duration: seconds };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage is optional. */ }
    setNow(Date.now());
    setCooldown(next);
  };
  return { remaining, duration: active.duration, start, isBlocked: () => remainingLoginSeconds(active.until) > 0 };
}
