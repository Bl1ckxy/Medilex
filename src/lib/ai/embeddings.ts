import { gemini, EMBEDDING_MODELS, EMBEDDING_DIMENSIONS, cleanGeminiModelName, isRetryableGeminiError } from './providers';

export async function embedText(text: string, opts?: { taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' }): Promise<number[]> {
    let lastError: unknown;
    for (const model of EMBEDDING_MODELS) {
        try {
            const response = await gemini.models.embedContent({
                model: cleanGeminiModelName(model),
                contents: text,
                config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: opts?.taskType || 'RETRIEVAL_DOCUMENT' },
            });
            const values = response.embeddings?.[0]?.values;
            if (!values || values.length === 0) {
                console.error(`Embedding model ${model} returned empty values`);
                throw new Error('Gemini returned an invalid embedding (empty values)');
            }
            if (values.length !== EMBEDDING_DIMENSIONS) {
                console.error(
                    `Embedding model ${model} returned ${values.length} dims, expected ${EMBEDDING_DIMENSIONS}`
                );
                throw new Error(
                    `Gemini returned an embedding of unexpected dimensionality: ${values.length}`
                );
            }
            if (process.env.NODE_ENV === 'development') console.log(`[EMBEDDING] Model succeeded: ${model} (${values.length} dims)`);
            return values;
        } catch (error) {
            lastError = error;
            if (error instanceof Error && (error.message.includes('404') || error.message.toLowerCase().includes('not found'))) {
                console.warn(`[EMBEDDING] Model not found, trying next: ${model}`);
                continue;
            }
            if (isRetryableGeminiError(error)) {
                console.warn(`[EMBEDDING] Transient provider error, trying next: ${model}`);
                continue;
            }
            console.error(`[EMBEDDING] Model error: ${model}`, error);
            break;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('All embedding models failed');
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => embedText(t, { taskType: 'RETRIEVAL_DOCUMENT' })));
}
