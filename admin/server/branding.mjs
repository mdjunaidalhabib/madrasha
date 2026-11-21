const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

export function institutionHtml(html, institution, apiBase) {
  const name = escapeHtml(institution.name);
  const icon = institution.logo
    ? escapeHtml(
        `${apiBase}/website/public/${encodeURIComponent(institution.slug)}/icon/icon-512.png`,
      )
    : "";
  return html
    .replace(/<title>[^<]*<\/title>/i, `<title>${name}</title>`)
    .replace(
      /(<meta\s+(?:name|property)="([^"]+)"\s+content=")[^"]*("\s*\/?>)/gi,
      (tag, before, key, after) => {
        if (
          [
            "description",
            "og:site_name",
            "og:title",
            "og:description",
            "og:image:alt",
            "twitter:title",
            "twitter:description",
            "twitter:image:alt",
            "apple-mobile-web-app-title",
          ].includes(key)
        )
          return before + name + after;
        if (["og:image", "twitter:image"].includes(key)) return before + icon + after;
        return tag;
      },
    );
}
