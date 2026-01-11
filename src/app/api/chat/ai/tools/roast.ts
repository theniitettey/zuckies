import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";

/**
 * Roast Tools
 *
 * Playful, constructive roasts for GitHub profiles and general URLs.
 * Safe by design: light sarcasm + quick tips; never mean-spirited.
 *
 * Tools:
 * - roast_github: Normalize handle/URL, fetch page, derive stats, craft roast + tips
 * - roast_url: Fetch any URL (except LinkedIn), detect type, craft roast + tips
 * - generate_roast_instructions: Return style guide for performing roasts inline
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

  const safeFetch = async (
    url: string,
    timeoutMs = 15000
  ): Promise<{
    ok: boolean;
    status: number;
    text?: string;
    headers?: Headers;
  }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      return { ok: res.ok, status: res.status, text, headers: res.headers };
    } catch (err) {
      clearTimeout(timeoutId);
      return { ok: false, status: 0 };
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
      const res = await safeFetch(url);
      const username = url.split("github.com/")[1]?.split("/")[0] || "unknown";

      if (!res.ok || !res.text) {
        return `couldn't peek your github (${url})—either private or blocking bots. i'll keep it light:\nkaishhh!!! your repo game is giving mysterious energy. quick tips:\n- add a clean README to your top projects\n- pin your best 2-3 repos\n- a short bio helps people vibe with your work`;
      }

      const html = res.text;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : username;
      const repoCount = html.match(/(\d+)\s*repositories/i)?.[1];
      const followers = html.match(/(\d+)\s*followers/i)?.[1];
      const following = html.match(/(\d+)\s*following/i)?.[1];
      const stars = html.match(/(\d+)\s*stars/i)?.[1];
      const bio = html
        .match(/<div[^>]*class="[^"]*user-profile-bio[^"]*"[^>]*>([^<]+)/i)?.[1]
        ?.trim();

      // heuristics
      const repoN = repoCount ? parseInt(repoCount, 10) : NaN;
      const followersN = followers ? parseInt(followers, 10) : NaN;
      const starsN = stars ? parseInt(stars, 10) : NaN;

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

      const res = await safeFetch(url);
      if (!res.ok || !res.text) {
        return `couldn't fetch ${url}. still, small roast: title your page well, add meta description, and keep loading fast. we move.`;
      }

      const html = res.text;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "unknown";
      const descMatch =
        html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
        html.match(/<meta\s+content="([^"]*)"[^>]*name="description"/i) ||
        html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
      const description = descMatch ? descMatch[1].trim() : "";

      // simple content signal
      const textLen = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").length;
      const hasImages = /<img\b/i.test(html);
      const hasVideo = /<video\b|youtube\.com|youtu\.be/i.test(html);

      const lines: string[] = [];
      lines.push(`url: ${url}`);
      lines.push(`title: ${title.toLowerCase()}`);

      if (!description)
        lines.push(
          "meta description dey ghost. add one so google no go confuse."
        );
      if (textLen < 800)
        lines.push(
          "content slim fit. give me small story or screenshots—no be only vibes."
        );
      if (!hasImages && !hasVideo)
        lines.push(
          "visuals on strike. one hero image go change the whole mood."
        );

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
