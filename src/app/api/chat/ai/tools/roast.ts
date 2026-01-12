import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";
import { logToolExecution } from "./logger";

/* =====================================================
   SHARED HELPERS
===================================================== */

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

const normalizeGithub = (input: string) => {
  let v = input.trim().replace(/^@/, "");
  if (!v.startsWith("http")) v = `https://github.com/${v}`;
  return v.replace(/\/$/, "");
};

const fetchGitHub = async (url: string) => {
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) throw new Error(`GitHub API failed: ${res.status}`);
  return res.json();
};

const fetchWithJina = async (url: string): Promise<string> => {
  const res = await fetch(`https://r.jina.ai/${url}`);
  if (!res.ok) throw new Error("Jina fetch failed");
  const raw = await res.text();

  try {
    const json = JSON.parse(raw);
    return [json.title, json.description, json.content]
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return raw;
  }
};

const safeAll = async <T extends any[]>(promises: {
  [K in keyof T]: Promise<T[K]>;
}): Promise<Partial<T>> => {
  const results = await Promise.allSettled(promises);
  return results.map((r) =>
    r.status === "fulfilled" ? r.value : undefined
  ) as Partial<T>;
};

const finalize = (lines: string[], intensity: string, content: string) => {
  const base = lines.join("\n");
  if (intensity === "spicy") return base + "\n🌶️ small pepper, earned.";
  if (intensity === "medium") return base + "\nlight slap, heavy love.";
  return base;
};

/* =====================================================
   TOOL FACTORY
===================================================== */

export function createRoastTools(session: ISession) {
  /* =====================================================
     1️⃣ GITHUB PROFILE ROAST
  ===================================================== */

  const roastGithubProfileTool = ai.defineTool(
    {
      name: "roast_github_profile",
      description:
        "Roast a GitHub profile using real stats (GitHub API) + page context (Jina).",
      inputSchema: z.object({
        handle: z.string(),
        intensity: z.enum(["light", "medium", "spicy"]).optional(),
      }),
      outputSchema: z.string(),
    },
    async ({ handle, intensity = "light" }) => {
      logToolExecution("roast_github_profile", { handle });

      const url = normalizeGithub(handle);
      const username = url.split("github.com/")[1];

      const [profile, pageText] = await safeAll([
        fetchGitHub(`https://api.github.com/users/${username}`),
        fetchWithJina(url),
      ]);

      if (!profile) {
        return "github profile dodged me. either private or hiding.";
      }

      const lines: string[] = [];

      lines.push(`okay **${username}**, I actually checked 👀`);
      lines.push(
        `- repos: ${profile.public_repos}\n- followers: ${profile.followers}\n- following: ${profile.following}`
      );
      lines.push("");

      if (profile.bio) {
        lines.push(`bio: "${profile.bio}"`);
      } else {
        lines.push(
          "bio empty. mysterious dev arc. recruiters no like riddles."
        );
      }

      if (!profile.blog && pageText && !pageText.match(/https?:\/\//)) {
        lines.push("no portfolio link spotted. code dey, story missing.");
      }

      lines.push("profile foundation dey. now make am loud.");

      return finalize(lines, intensity, pageText ?? "");
    }
  );

  /* =====================================================
     2️⃣ GITHUB REPO ROAST
  ===================================================== */

  const roastGithubRepoTool = ai.defineTool(
    {
      name: "roast_github_repo",
      description:
        "Roast a specific GitHub repository using API stats + README context.",
      inputSchema: z.object({
        repo_url: z.string().describe("Full GitHub repository URL"),
        intensity: z.enum(["light", "medium", "spicy"]).optional(),
      }),
      outputSchema: z.string(),
    },
    async ({ repo_url, intensity = "light" }) => {
      logToolExecution("roast_github_repo", { repo_url });

      const cleanUrl = normalizeGithub(repo_url);
      const [, owner, repo] = cleanUrl.split("/").slice(-3);

      const [repoData, readmeData] = await safeAll([
        fetchGitHub(`https://api.github.com/repos/${owner}/${repo}`),
        fetchGitHub(`https://api.github.com/repos/${owner}/${repo}/readme`)
          .then((r) => Buffer.from(r.content, "base64").toString("utf-8"))
          .catch(() => ""),
      ]);

      if (!repoData) {
        return "repo dodged me. either deleted or undercover.";
      }

      const readme = readmeData || "";
      const hasImages = /!\[.*\]\(.*\)/.test(readme);
      const hasSetup = /install|setup|usage/i.test(readme);

      const lines: string[] = [];

      lines.push(`repo autopsy: **${repo}** 🧪`);
      lines.push(
        `- ⭐ ${repoData.stargazers_count} | 🍴 ${repoData.forks_count}`
      );
      lines.push(`- last update: ${repoData.updated_at}`);
      lines.push("");

      if (!readme) {
        lines.push("README missing. raw repo energy. explain yourself.");
      } else {
        lines.push(`README length: ${readme.length} chars`);

        if (readme.length < 400)
          lines.push("README thin. vibes without context.");
        if (!hasImages)
          lines.push("no screenshots. trust-me-bro architecture detected.");
        if (!hasSetup) lines.push("no setup steps. mind-reading required.");
      }

      lines.push("effort dey. presentation still lagging.");

      return finalize(lines, intensity, readme ?? "");
    }
  );

  /* =====================================================
     3️⃣ GENERIC URL ROAST (JINA ONLY)
  ===================================================== */

  const roastUrlTool = ai.defineTool(
    {
      name: "roast_url",
      description:
        "Roast any public URL using visible content only (no SEO/meta assumptions).",
      inputSchema: z.object({
        url: z.string(),
        context: z.string().optional(),
        intensity: z.enum(["light", "medium", "spicy"]).optional(),
      }),
      outputSchema: z.string(),
    },
    async ({ url, context = "", intensity = "light" }) => {
      logToolExecution("roast_url", { url });

      const content = await fetchWithJina(url);

      const lines: string[] = [];
      lines.push(`url roast: ${url}`);

      if (content.length < 800)
        lines.push("content short. page feels unfinished.");

      if (!/!\[.*\]\(.*\)/.test(content))
        lines.push("no visuals detected. text-only grind.");

      if (context.toLowerCase().includes("portfolio")) {
        lines.push(
          "portfolio check: add 2–3 case studies. problem → approach → result."
        );
      }

      lines.push("no bad vibes. just polish.");

      return finalize(lines, intensity, content);
    }
  );

  return [roastGithubProfileTool, roastGithubRepoTool, roastUrlTool];
}
