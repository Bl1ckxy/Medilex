import { generateGeminiContentWithModels, isRetryableGeminiError, OCR_MODELS } from './providers';

const OCR_SYSTEM_PROMPT = [
    'You are a forensic document transcription engine for medical and legal records, including handwritten doctors notes.',
    'Transcribe every visible character exactly; do not summarize, infer, translate, or silently correct content.',
    'For handwriting, inspect letter shapes, connected strokes, overwriting, abbreviations, and punctuation carefully.',
    'Preserve headings, tables, line breaks, dates, names, numbers, units, medicine names, dosages, signatures, stamps, and uncertainty.',
    'Never guess a diagnosis, drug, dosage, date, measurement, or name from context.',
    'When a character or word is uncertain, use [unclear: best reading] and when it cannot be read, use [illegible].',
    'Return only the transcription.',
].join(' ');

async function ocrWithModelFallback(mimeType: string, data: Buffer, prompt: string): Promise<string> {
    let lastError: unknown;
    for (const model of OCR_MODELS) {
        try {
            const response = await generateGeminiContentWithModels({
                config: { systemInstruction: OCR_SYSTEM_PROMPT },
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: data.toString('base64') } },
                    ],
                }],
            }, [model]);
            return response.text?.trim() ?? '';
        } catch (error) {
            lastError = error;
            if (error instanceof Error && (error.message.includes('404') || error.message.toLowerCase().includes('not found'))) {
                console.warn(`[OCR] Model not found, trying next: ${model}`);
                continue;
            }
            if (isRetryableGeminiError(error)) {
                console.warn(`[OCR] Transient provider error, trying next: ${model}`);
                continue;
            }
            console.error(`[OCR] Model error: ${model}`, error);
            break;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('OCR request failed');
}

export async function ocrImage(image: Buffer, pageNumber: number, mimeType: string): Promise<string> {
    return ocrWithModelFallback(mimeType, image, `Transcribe page ${pageNumber}.`);
}

export async function ocrPdf(pdf: Buffer): Promise<string> {
    return ocrWithModelFallback('application/pdf', pdf, 'Transcribe every page of this PDF in order. Separate pages with clear page headings.');
}

export async function ocrImages(images: Buffer[], mimeType: string): Promise<string> {
    const pages = await Promise.all(images.map((image, index) => ocrImage(image, index + 1, mimeType)));
    return pages.map((text, index) => `\n--- Page ${index + 1} ---\n${text}`).join('\n').trim();
}
