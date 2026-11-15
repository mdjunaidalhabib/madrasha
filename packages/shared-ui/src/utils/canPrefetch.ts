/** Optional menu prefetch must respect metered connections and offline mode. */
export function canPrefetch() {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return (
    navigator.onLine !== false &&
    !connection?.saveData &&
    !/^(slow-2g|2g)$/.test(connection?.effectiveType || "")
  );
}
