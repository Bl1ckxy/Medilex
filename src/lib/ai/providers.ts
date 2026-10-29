import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';
import Groq from 'groq-sdk';
import { CohereClient } from 'cohere-ai';
import { env } from '@/env';

export const gemini = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
export const groq = new Groq({ apiKey: env.GROQ_API_KEY });
export const cohere = new CohereClient({ token: env.COHERE_API_KEY });

export const GEMINI_MODELS = [
    env.GOOGLE_AI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
] as const;

export const OCR_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
] as const;

export const EMBEDDING_MODELS = [
    'gemini-embedding-001',
    'gemini-embedding-2',
] as const;

export const EMBEDDING_DIMENSIONS = 768;

export const GROQ_MODELS = [
    env.GROQ_MODEL,
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'qwen/qwen3.6-27b',
] as const;

export function cleanGeminiModelName(rawModelName: string): string {
    return rawModelName.replace(/^(?:models\/)+/, '').trim();
}

function isNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes('404') || msg.includes('not found') || msg.includes('notfound');
    }
    return false;
}

export function isRetryableGeminiError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (
            msg.includes('503') ||
            msg.includes('429') ||
            msg.includes('rate limit') ||
            msg.includes('high demand') ||
            msg.includes('overloaded') ||
            msg.includes('internal error') ||
            msg.includes('"code":500')
        );
    }
    return false;
}

function isGroqRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (
            msg.includes('404') ||
            msg.includes('not found') ||
            msg.includes('decommission') ||
            msg.includes('rate limit') ||
            msg.includes('429') ||
            msg.includes('503') ||
            msg.includes('500')
        );
    }
    return false;
}

export async function generateGeminiContent(
    params: Omit<GenerateContentParameters, 'model'>,
    models: readonly string[] = GEMINI_MODELS,
    onModelSucceeded?: (model: string) => void,
) {
    let lastError: unknown;
    const cleanModels = [...new Set(models.map(cleanGeminiModelName))];
    for (const model of cleanModels) {
        try {
            const response = await gemini.models.generateContent({ ...params, model });
            onModelSucceeded?.(model);
            console.log(`[GEMINI] Model succeeded: ${model}`);
            return response;
        } catch (error) {
            lastError = error;
            if (isNotFoundError(error)) {
                console.warn(`[GEMINI] Model not found, trying next: ${model}`);
                continue;
            }
            if (isRetryableGeminiError(error)) {
                console.warn(`[GEMINI] Transient provider error, trying next: ${model}`);
                continue;
            }
            console.error(`[GEMINI] Model error: ${model}`, error);
            break;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}

export async function generateGeminiContentWithModels(
    params: Omit<GenerateContentParameters, 'model'>,
    models: readonly string[],
) {
    return generateGeminiContent(params, models);
}

export async function groqChat(
    prompt: string,
    models: readonly string[] = GROQ_MODELS,
): Promise<string> {
    const result = await groqChatWithModel(prompt, models);
    return result.text;
}

export async function groqChatWithModel(
    prompt: string,
    models: readonly string[] = GROQ_MODELS,
): Promise<{ text: string; model: string }> {
    let lastError: unknown;
    for (const model of models.filter((candidate): candidate is string => Boolean(candidate?.trim()))) {
        try {
            const response = await groq.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
            });
            console.log(`[GROQ] Model succeeded: ${model}`);
            return { text: response.choices[0]?.message.content ?? '', model };
        } catch (error) {
            lastError = error;
            if (isGroqRetryableError(error)) {
                console.warn(`[GROQ] Model error, trying next: ${model}`, error instanceof Error ? error.message : error);
                continue;
            }
            console.error(`[GROQ] Model error: ${model}`, error);
            break;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Groq request failed');
}

export async function geminiText(prompt: string, model = 'gemini-3.6-flash') {
    const result = await geminiTextWithModel(prompt, model);
    return result.text;
}

export async function geminiTextWithModel(prompt: string, model = 'gemini-3.6-flash') {
    const models = [model, ...GEMINI_MODELS.filter((candidate) => candidate !== model)];
    const cleanedModels = models.map(cleanGeminiModelName).filter(Boolean);
    let usedModel = '';
    const response = await generateGeminiContent({ contents: prompt }, cleanedModels, (succeededModel) => {
        usedModel = succeededModel;
    });
    return { text: response.text ?? '', model: usedModel || cleanedModels[0] || model };
}

export async function cohereRerank(query: string, documents: string[], topN = documents.length) {
    if (documents.length === 0) return [];
    const response = await cohere.rerank({ model: 'rerank-english-v3.0', query, documents, topN });
    return response.results.map((item) => ({ index: item.index, relevanceScore: item.relevanceScore }));
}
