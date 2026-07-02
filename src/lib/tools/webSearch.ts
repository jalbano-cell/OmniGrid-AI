import { logEvent, logError } from "@/lib/services/logger";
import type { ToolDefinition, ToolResult } from "./types";

export interface WebSearchInput {
  query: string;
  /** Tavily supports 0-20 results per call; there is no page/offset cursor. */
  maxResults?: number;
}

export interface WebSearchResultItem {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export interface WebSearchOutput {
  items: WebSearchResultItem[];
}

export function isWebSearchConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

/**
 * web_search(query) — backed by the Tavily Search API. Returns real results
 * only; if credentials aren't configured we return a clear error rather
 * than fabricating results.
 */
async function execute({ query, maxResults = 20 }: WebSearchInput): Promise<ToolResult<WebSearchOutput>> {
  if (!isWebSearchConfigured()) {
    const error = "web_search is not configured. Set TAVILY_API_KEY in .env (see .env.example).";
    await logEvent({ type: "SEARCH", message: "web_search skipped — not configured", metadata: { query } });
    return { ok: false, error };
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: Math.min(20, Math.max(1, maxResults)),
        search_depth: "basic",
        topic: "general",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Tavily API returned ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };

    const items: WebSearchResultItem[] = (json.results ?? []).map((r) => ({
      title: r.title,
      link: r.url,
      snippet: r.content ?? "",
      displayLink: safeHostname(r.url),
    }));

    await logEvent({
      type: "SEARCH",
      message: `web_search("${query}") returned ${items.length} results`,
      metadata: { query, resultCount: items.length },
    });

    return { ok: true, data: { items } };
  } catch (err) {
    await logError(`web_search("${query}") failed`, err, { query });
    return { ok: false, error: err instanceof Error ? err.message : "web_search failed" };
  }
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export const webSearchTool: ToolDefinition<WebSearchInput, WebSearchOutput> = {
  name: "web_search",
  description: "Search the web for a query and return titles, links, and snippets.",
  execute,
};
