import type { z } from 'zod';

export function stripFences(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
    let out = fenced.trim();
    if (out.startsWith('```json')) out = out.slice(7);
    if (out.startsWith('```')) out = out.slice(3);
    if (out.endsWith('```')) out = out.slice(0, -3);
    return out.trim();
}

function isProviderError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null && 'status' in error) {
        const status = error.status;
        if (typeof status === 'number' && status >= 400) return true;
        if (typeof status === 'string' && /^\d{3}$/.test(status) && Number(status) >= 400) return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    return /(429|5\d{2}|rate limit|too many requests|provider|network|timed? out|fetch failed)/i.test(message);
}

/**
 * Parses and optionally validates a provider response. Parse and schema
 * errors retry the same provider exactly once; provider errors propagate so
 * the caller's fallback chain can run.
 */
export async function parseJsonWithRetry<T>(
    call: () => Promise<string>,
    provider: string,
    schema?: z.ZodType<T>,
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        let rawText: string;
        try {
            rawText = await call();
        } catch (error) {
            if (isProviderError(error)) throw error;
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === 0) {
                console.warn(`[JSON] ${lastError.message} from ${provider}. Retrying (1/1)...`);
            }
            continue;
        }

        try {
            const parsed: unknown = JSON.parse(stripFences(rawText));
            if (schema) {
                const result = schema.safeParse(parsed);
                if (!result.success) {
                    throw new Error(`Schema drift: ${result.error.issues[0]?.message ?? 'invalid response'}`);
                }
                return result.data;
            }
            return parsed as T;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === 0) {
                console.warn(`[JSON] ${lastError.message} from ${provider}. Retrying (1/1)...`);
            }
        }
    }

    throw new Error(`[JSON] Failed after retry from ${provider}: ${lastError?.message ?? 'unknown error'}`);
}
