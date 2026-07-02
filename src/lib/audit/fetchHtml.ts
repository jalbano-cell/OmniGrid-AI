export interface FetchHtmlResult {
  ok: boolean;
  html: string;
  status: number;
  finalUrl: string;
  tookMs: number;
  hasSsl: boolean;
  error?: string;
}

/**
 * Single shared fetcher used by both lead discovery (contact extraction) and
 * the website auditor, so we only ever hit a target site's homepage once per
 * pipeline run.
 */
export async function fetchHtml(url: string, timeoutMs = 12_000): Promise<FetchHtmlResult> {
  const started = Date.now();
  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const res = await fetch(normalizedUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OmniGridAI-Auditor/1.0; +internal-agency-tool)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await res.text();
    const finalUrl = res.url || normalizedUrl;
    return {
      ok: res.ok,
      html,
      status: res.status,
      finalUrl,
      tookMs: Date.now() - started,
      hasSsl: finalUrl.startsWith("https://"),
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    // If https failed outright (e.g. no valid cert / connection refused) and
    // we weren't already trying http, retry once over http purely to salvage
    // contact info — hasSsl stays false either way, which the audit surfaces.
    if (normalizedUrl.startsWith("https://")) {
      try {
        const httpUrl = normalizedUrl.replace("https://", "http://");
        const res = await fetch(httpUrl, {
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; OmniGridAI-Auditor/1.0)" },
        });
        const html = await res.text();
        return {
          ok: res.ok,
          html,
          status: res.status,
          finalUrl: res.url || httpUrl,
          tookMs: Date.now() - started,
          hasSsl: false,
          error: undefined,
        };
      } catch (err2) {
        return {
          ok: false,
          html: "",
          status: 0,
          finalUrl: normalizedUrl,
          tookMs: Date.now() - started,
          hasSsl: false,
          error: err2 instanceof Error ? err2.message : "fetch failed",
        };
      }
    }
    return {
      ok: false,
      html: "",
      status: 0,
      finalUrl: normalizedUrl,
      tookMs: Date.now() - started,
      hasSsl: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}
