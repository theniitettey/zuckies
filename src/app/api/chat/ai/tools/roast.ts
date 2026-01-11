import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";

/**
 * Roast Tools
 *
 * Playful, constructive roasts for GitHub profiles and general URLs.
 * Safe by design: light sarcasm + quick tips; never mean-spirited.
 *
 * Uses Jina AI Reader API for clean HTML-to-Markdown conversion.
 *
 * Tools:
 * - roast_github: Normalize handle/URL, fetch via Jina, extract key stats, craft roast + tips
 * - roast_url: Fetch any URL via Jina (except LinkedIn), craft roast + tips
 */
export function createRoastTools(session: ISession) {
  const normalizeToGitHubUrl = (input: string) => {
    let url = input.trim();
    url = url.replace(/^@/, "");
    const isLikelyUsername =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(url) &&
      !url.includes(".");
    if (isLikelyUsername) return `https://github.com/${url}`;
    if (url.includes("github.com") && !url.startsWith("http"))
      return `https://${url}`;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      if (url.includes(".")) return `https://${url}`;
      return `https://github.com/${url}`;
    }
    return url;
  };

  /**
   * Fetch URL content via Jina AI Reader API
   * Returns clean Markdown content extracted from the page
   */
  const fetchWithJina = async (
    url: string,
    timeoutMs = 30000
  ): Promise<{
    ok: boolean;
    markdown?: string;
    error?: string;
  }> => {
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(jinaUrl, {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          error: `Jina API returned status ${response.status}`,
        };
      }

      const data = (await response.json()) as { content?: string };
      const markdown = data.content || "";

      if (!markdown) {
        return { ok: false, error: "No content returned from Jina" };
      }

      return { ok: true, markdown };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      return {
        ok: false,
        error: `Failed to fetch: ${errorMsg}`,
      };
    }
  };

  const roastGithubTool = ai.defineTool(
    {
      name: "roast_github",
      description:
        "Playfully roast a GitHub profile or repo URL/username. Light sarcasm + constructive tips; never mean.",
      inputSchema: z.object({
        handle: z
          .string()
          .describe(
            "GitHub username or URL (can be bare username, @handle, or full URL)"
          ),
        intensity: z
          .enum(["light", "medium", "spicy"]) // 'spicy' is still safe
          .optional()
          .describe("Roast intensity; default 'light'. Always remain kind."),
        include_tips: z
          .boolean()
          .optional()
          .describe("Append 2-3 constructive tips after roast. Default true."),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      const url = normalizeToGitHubUrl(input.handle);
      const result = await fetchWithJina(url);
      const username = url.split("github.com/")[1]?.split("/")[0] || "unknown";

      if (!result.ok || !result.markdown) {
        return `couldn't peek your github (${url})—either private or unreachable. i'll keep it light:\nkaishhh!!! your repo game is giving mysterious energy. quick tips:\n- add a clean README to your top projects\n- pin your best 2-3 repos\n- a short bio helps people vibe with your work`;
      }

      const markdown = result.markdown;

      // Extract stats from markdown content
      const repoMatch = markdown.match(/(\d+)\s*repositories?/i);
      const followerMatch = markdown.match(/(\d+)\s*followers?/i);
      const followingMatch = markdown.match(/(\d+)\s*following/i);
      const starMatch = markdown.match(/(\d+)\s*stars?/i);
      const bioMatch = markdown.match(/bio[:\s]+([^\n]+)/i);

      const repoN = repoMatch ? parseInt(repoMatch[1], 10) : NaN;
      const followersN = followerMatch ? parseInt(followerMatch[1], 10) : NaN;
      const followingN = followingMatch ? parseInt(followingMatch[1], 10) : NaN;
      const starsN = starMatch ? parseInt(starMatch[1], 10) : NaN;
      const bio = bioMatch ? bioMatch[1].trim() : "";

      const lines: string[] = [];
      const intensity = input.intensity || "light";

      // opener
      lines.push(`okay ${username}, let's peep the vibes 👀`);

      if (!bio) {
        lines.push(
          "bio be like silent mode. give us one line so recruiters no go fear."
        );
      }
      if (!isNaN(repoN)) {
        if (repoN === 0) lines.push("repos: empty fridge. we go chop when? 🍽️");
        else if (repoN < 4)
          lines.push(
            "repos looking like starter pack. we love the minimalism, but ship small things weekly."
          );
        else
          lines.push(
            "nice spread of repos. keep shipping—consistency > perfection."
          );
      } else {
        lines.push(
          "couldn't read repo count. if it's plenty, kaishhh!!! keep the heat on."
        );
      }

      if (!isNaN(followersN)) {
        if (followersN < 5)
          lines.push(
            "followers lowkey—underground legend. drop READMEs and pin projects to help folks find you."
          );
        else if (followersN < 50)
          lines.push(
            "decent followers. a clean portfolio link could level it up."
          );
        else lines.push("crowd dey. keep quality high and docs crisp.");
      }

      if (!isNaN(starsN)) {
        if (starsN === 0)
          lines.push("stars = zero? we move. good docs + demos attract stars.");
        else lines.push("stars on deck. keep showcasing results, not vibes.");
      }

      // friendly close
      lines.push("no be shade—just love. keep building. we move. 🚀");

      const tipsEnabled = input.include_tips !== false;
      if (tipsEnabled) {
        const tips = [
          "add short READMEs with setup + screenshot",
          "pin 2-3 repos that represent you",
          "write 1-2 line bio + stack",
        ];
        lines.push("\nquick tips:");
        tips.forEach((t) => lines.push(`- ${t}`));
      }

      const base = lines.join("\n");
      if (intensity === "spicy")
        return base + "\nsmall ginger only—never disrespect. correct!";
      if (intensity === "medium")
        return base + "\nlight slap, heavy love. e go be.";
      return base;
    }
  );

  const roastUrlTool = ai.defineTool(
    {
      name: "roast_url",
      description:
        "Playfully roast a general URL (portfolio, docs, blog, project link). Safe, constructive, and helpful.",
      inputSchema: z.object({
        url: z
          .string()
          .describe("Any non-LinkedIn URL to review and roast kindly"),
        context: z
          .string()
          .optional()
          .describe("Optional context: 'portfolio', 'docs', 'project', etc."),
        intensity: z.enum(["light", "medium", "spicy"]).optional(),
        include_tips: z.boolean().optional(),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      let url = input.url.trim();
      if (url.includes("linkedin.com")) {
        return "linkedin no dey allow me peek. share another link and i go roast gently.";
      }
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = url.includes(".")
          ? `https://${url}`
          : `https://github.com/${url}`;
      }

      const result = await fetchWithJina(url);
      if (!result.ok || !result.markdown) {
        return `couldn't fetch ${url}. still, small roast: title your page well, add meta description, and keep loading fast. we move.`;
      }

      const markdown = result.markdown;
      const lines: string[] = [];
      lines.push(`url: ${url}`);

      // Extract title from markdown (usually first heading or metadata)
      const titleMatch =
        markdown.match(/^#\s+(.+)$/m) || markdown.match(/title:\s*(.+)/i);
      const title = titleMatch ? titleMatch[1].trim() : "unknown";
      lines.push(`title: ${title.toLowerCase()}`);

      // Check for description in markdown
      const hasDescription = markdown.match(/description:|summary:|overview:/i);
      if (!hasDescription) {
        lines.push(
          "meta description dey ghost. add one so google no go confuse."
        );
      }

      // Simple heuristic: check content length and media presence
      const contentLen = markdown.length;
      const hasImages = /!\[.*\]\(.*\)/i.test(markdown); // markdown image syntax
      const hasVideo = /youtube|youtu\.be|video/i.test(markdown);

      if (contentLen < 800) {
        lines.push(
          "content slim fit. give me small story or screenshots—no be only vibes."
        );
      }
      if (!hasImages && !hasVideo) {
        lines.push(
          "visuals on strike. one hero image go change the whole mood."
        );
      }

      const ctx = (input.context || "").toLowerCase();
      if (ctx.includes("portfolio")) {
        lines.push(
          "portfolio with zero case studies? omo. add 2 short writeups: problem → approach → outcome."
        );
      } else if (ctx.includes("docs")) {
        lines.push(
          "docs: start with quickstart + examples. less poetry, more copy-paste."
        );
      } else if (ctx.includes("project")) {
        lines.push(
          "project page? drop live demo + repo link front and center."
        );
      }

      lines.push("no bad vibes—roast with love. squad dey oo. 💪");

      const tipsEnabled = input.include_tips !== false;
      if (tipsEnabled) {
        const tips = [
          "add meta description + social preview",
          "show 1-2 screenshots or a short demo",
          "keep critical info above the fold",
        ];
        lines.push("\nquick tips:");
        tips.forEach((t) => lines.push(`- ${t}`));
      }

      const base = lines.join("\n");
      const intensity = input.intensity || "light";
      if (intensity === "spicy")
        return base + "\nlight pepper, heavy respect. correct!";
      if (intensity === "medium")
        return base + "\nsmall jab, big help. e go be.";
      return base;
    }
  );

  return [roastGithubTool, roastUrlTool];
}
