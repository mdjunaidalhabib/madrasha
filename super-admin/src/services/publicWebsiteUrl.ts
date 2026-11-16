export function getPublicWebsiteBaseUrl() {
  return (import.meta.env.VITE_PUBLIC_APP_URL?.trim() || (
    import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:5183`
      : "https://ems.hikmahit.com"
  )).replace(/\/+$/, "");
}

export function resolveWebsiteDemoImage(value: string) {
  return value.startsWith("/images/website-demo-")
    ? `${getPublicWebsiteBaseUrl()}${value}`
    : value;
}
