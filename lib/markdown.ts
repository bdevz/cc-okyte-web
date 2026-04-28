import type { Plugin } from "unified";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Rewrites relative links to source markdown files (`../docs/foo.md`,
 * `./domains/3-claude-code-config.md`) into in-app routes (`/learn/foo`,
 * `/learn/domain/3-claude-code-config`). Preserves anchor fragments.
 *
 * Group inference matches the convention used by scripts/build-content.ts.
 */
export const remarkRewriteLinks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "link", (node: any) => {
      const url: string = node.url ?? "";
      if (!url || /^[a-z]+:\/\//i.test(url) || url.startsWith("#")) return;
      if (!url.endsWith(".md") && !url.includes(".md#")) return;

      const [pathPart, hash] = url.split("#");
      const segments = pathPart
        .replace(/\.md$/, "")
        .split("/")
        .filter((s) => s && s !== "." && s !== "..");

      let route = "/learn/";
      if (segments.includes("domains")) {
        const last = segments[segments.length - 1];
        route += `domain/${last}`;
      } else if (segments.includes("cheatsheets")) {
        const last = segments[segments.length - 1];
        route += `cheatsheet/${last}`;
      } else if (segments.includes("scenarios")) {
        const idx = segments.indexOf("scenarios");
        route += `scenario/${segments[idx + 1] ?? segments[segments.length - 1]}`;
      } else {
        route += segments[segments.length - 1] ?? "";
      }
      node.url = hash ? `${route}#${hash}` : route;
    });
  };
};
