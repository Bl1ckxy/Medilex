import { groqChat, geminiText } from '@/lib/ai/providers';
import { parseJsonWithRetry } from './json-parse';

/** Calls the configured provider, tolerates fenced JSON, retries once on malformed output. */
export async function generateJson<T>(prompt: string): Promise<T> {
    // Try Groq first with fallback chain
    try {
        return await parseJsonWithRetry<T>(() => groqChat(prompt), 'Groq');
    } catch (groqError) {
        console.warn('[GENERATE_JSON] Groq failed, falling back to Gemini:', groqError instanceof Error ? groqError.message : groqError);
    }

    // Fallback to Gemini with its own fallback chain
    try {
        return await parseJsonWithRetry<T>(() => geminiText(prompt), 'Gemini');
    } catch (geminiError) {
        console.error('[GENERATE_JSON] Both Groq and Gemini failed:', geminiError instanceof Error ? geminiError.message : geminiError);
        throw new Error('All AI providers failed to return valid JSON');
    }
}
