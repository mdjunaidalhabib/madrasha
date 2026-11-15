import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/** Cache only the small entry shell at install; feature chunks stay on demand. */
export function panelPerformance(app: "admin" | "super-admin"): Plugin {
  let root = "";
  let fontFile = "";
  return {
    name: "ems-panel-performance",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      const source = readFileSync(resolve(root, "public/fonts/Kalpurush.ttf"));
      const hash = createHash("sha256")
        .update(source)
        .digest("hex")
        .slice(0, 12);
      fontFile = `assets/Kalpurush-${hash}.ttf`;
      this.emitFile({ type: "asset", fileName: fontFile, source });
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replaceAll("/fonts/Kalpurush.ttf", `/${fontFile}`);
      },
    },
    generateBundle(_options, bundle) {
      const shell = new Set<string>(["/", `/${fontFile}`]);
      const visit = (file: string) => {
        if (shell.has(`/${file}`)) return;
        shell.add(`/${file}`);
        const chunk = bundle[file];
        if (chunk?.type !== "chunk") return;
        chunk.imports.forEach(visit);
        const css = (
          chunk as typeof chunk & {
            viteMetadata?: { importedCss: Set<string> };
          }
        ).viteMetadata?.importedCss;
        css?.forEach((file) => shell.add(`/${file}`));
      };
      Object.values(bundle).forEach((item) => {
        if (item.type === "chunk" && item.isEntry) visit(item.fileName);
      });
      const assets = Object.keys(bundle).filter((file) =>
        /^assets\/.*\.(js|css|ttf|woff2?)$/.test(file),
      );
      // Include chunk content, not just names, so every changed release has a new cache.
      const hash = createHash("sha256");
      Object.values(bundle).forEach((item) =>
        hash.update(item.type === "chunk" ? item.code : item.source),
      );
      const version = hash.digest("hex").slice(0, 16);
      const template = readFileSync(
        fileURLToPath(new URL("./panel-sw.js", import.meta.url)),
        "utf8",
      );
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template
          .replace("__CACHE_PREFIX__", JSON.stringify(`ems-${app}-`))
          .replace("__VERSION__", JSON.stringify(version))
          .replace("__SHELL_FILES__", JSON.stringify([...shell]))
          .replace(
            "__ASSET_FILES__",
            JSON.stringify(assets.map((file) => `/${file}`)),
          ),
      });
    },
  };
}
