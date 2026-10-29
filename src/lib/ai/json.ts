import type { ZodType } from 'zod';
import { groqChatWithModel, geminiTextWithModel } from '@/lib/ai/providers';
import { parseJsonWithRetry } from './json-parse';

/** Calls the configured provider, tolerates fenced JSON, retries once on malformed output or schema drift. */
export async function generateJson<T>(prompt: string, schema?: ZodType<T>): Promise<T> {
    return (await generateJsonWithMetadata(prompt, schema)).result;
}

export async function generateJsonWithMetadata<T>(prompt: string, schema?: ZodType<T>): Promise<{
    result: T;
    provider: 'groq' | 'gemini';
    model: string;
    fallbackUsed: boolean;
}> {
    let groqModel = '';
    // Try Groq first with fallback chain
    try {
        const result = await parseJsonWithRetry<T>(async () => {
            const response = await groqChatWithModel(prompt);
            groqModel = response.model;
            return response.text;
        }, 'Groq', schema);
        return { result, provider: 'groq', model: groqModel, fallbackUsed: false };
    } catch (groqError) {
        console.warn('[GENERATE_JSON] Groq failed, falling back to Gemini:', groqError instanceof Error ? groqError.message : groqError);
    }

    // Fallback to Gemini with its own fallback chain
    try {
        let geminiModel = '';
        const result = await parseJsonWithRetry<T>(async () => {
            const response = await geminiTextWithModel(prompt);
            geminiModel = response.model;
            return response.text;
        }, 'Gemini', schema);
        return { result, provider: 'gemini', model: geminiModel, fallbackUsed: true };
    } catch (geminiError) {
        console.error('[GENERATE_JSON] Both Groq and Gemini failed');
        throw new Error('All AI providers failed to return valid JSON');
    }
}
