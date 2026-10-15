// ✓ FILE COMPLETE — json-parse.ts
// Pure helpers for parsing LLM JSON responses: fence stripping + one silent
// retry on malformed output. Kept dependency-free so it is unit-testable
// (json.ts itself imports provider clients, which need env at module load).

export function stripFences(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
    let out = fenced.trim();
    if (out.startsWith('```json')) out = out.slice(7);
    if (out.startsWith('```')) out = out.slice(3);
    if (out.endsWith('```')) out = out.slice(0, -3);
    return out.trim();
}

/**
 * Parses the provider's raw text as JSON. On a parse failure (malformed
 * output — truncated tokens, stray prose), retries the provider call
 * EXACTLY once before throwing. Provider errors themselves are NOT retried
 * here; they propagate so the caller's provider fallback chain runs.
 */
export async function parseJsonWithRetry<T>(call: () => Promise<string>, provider: string): Promise<T> {
    const raw = await call();
    try {
        return JSON.parse(stripFences(raw)) as T;
    } catch {
        console.warn(`[JSON] Malformed response from ${provider}, attempting 1 retry...`);
    }

    const retryRaw = await call();
    try {
        return JSON.parse(stripFences(retryRaw)) as T;
    } catch (secondError) {
        const detail = secondError instanceof Error ? secondError.message : String(secondError);
        throw new Error(`[JSON] Failed to parse LLM response after retry (${provider}): ${detail}`);
    }
}
