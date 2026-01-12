import ai from "../config";
import { z } from "genkit";
import { logToolExecution } from "./logger";

export function createFetchTools() {
  const fetchWithJinaTool = ai.defineTool(
    {
      name: "fetch_with_jina",
      description:
        "Fetch a URL through the Jina AI reader and return the extracted markdown content. Helpful for debugging URL fetches or quick previews.",
      inputSchema: z.object({
        url: z
          .string()
          .describe("URL to fetch (http/https). Adds https:// if missing."),
        timeout_ms: z
          .number()
          .optional()
          .describe("Optional timeout in milliseconds. Default 30000."),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("fetch_with_jina", input);

      let url = input.url.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }

      const jinaUrl = `https://r.jina.ai/${url}`;
      const timeoutMs = input.timeout_ms ?? 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(jinaUrl, {
          headers: { Accept: "*/*" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(
            `❌ fetch_with_jina: HTTP ${response.status} for ${url}`
          );
          return `fetch_with_jina failed (HTTP ${response.status}) for ${url}`;
        }

        const raw = await response.text();
        let markdown = "";
        try {
          const data = JSON.parse(raw) as {
            content?: string;
            title?: string;
            description?: string;
            url?: string;
          };
          const primaryContent = data.content || "";
          const header = [data.title, data.description, data.url]
            .filter(Boolean)
            .join("\n\n");
          markdown = [header, primaryContent].filter(Boolean).join("\n\n");
        } catch (err) {
          // Fallback: Jina sometimes returns markdown/text directly
          markdown = raw;
        }

        if (!markdown.trim()) {
          console.error(
            `❌ fetch_with_jina: empty content for ${url} (raw length ${raw.length})`
          );
          const snippet = raw || "<empty>";
          return `no content returned for ${url}. raw preview: ${snippet}`;
        }

        console.log(
          `✅ fetch_with_jina: fetched ${url}, length=${markdown.length}`
        );
        return markdown;
      } catch (err) {
        clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ fetch_with_jina error for ${url}:`, err);
        return `fetch_with_jina error for ${url}: ${msg}`;
      }
    }
  );

  return [fetchWithJinaTool];
}
