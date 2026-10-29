import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { chunkText } from './chunker';
import { embedTexts } from './embeddings';
import { constantTimeEqual, sha256 } from './hash';
import { ocrImages, ocrPdf } from './ocr';

export interface IngestionResult {
    documentId: string;
    pageCount: number;
    chunkCount: number;
    ocrStatus: 'completed' | 'failed';
    embeddingStatus: 'completed' | 'failed';
    ocrError?: string;
}

export async function ingestDocument(documentId: string, expectedHash: string): Promise<IngestionResult> {
    const supabase = createSupabaseAdminClient();
    const { data: document, error } = await (supabase as any).from('documents').select('*').eq('id', documentId).single();
    if (error || !document) throw new Error('Document not found');
    const { data: file, error: downloadError } = await supabase.storage.from('case-documents').download(document.storage_path as string);
    if (downloadError || !file) throw new Error(downloadError?.message ?? 'Unable to download document');
    const bytes = Buffer.from(await file.arrayBuffer());
    const serverHash = sha256(bytes);
    if (!constantTimeEqual(expectedHash, serverHash)) throw new Error('Document hash mismatch');
    await (supabase as any).from('document_chunks').delete().eq('document_id', documentId);
    await supabase.from('documents').update({
        server_hash: serverHash,
        ocr_status: 'processing',
        embedding_status: 'pending',
    }).eq('id', documentId);

    // OCR Phase
    let extractedText = '';
    let ocrStatus: 'completed' | 'failed' = 'failed';
    let ocrError: string | undefined;

    try {
        const isPdf = document.mime_type === 'application/pdf';
        extractedText = isPdf ? await ocrPdf(bytes) : await ocrImages([bytes], document.mime_type);
        ocrStatus = 'completed';
        if (process.env.NODE_ENV === 'development') console.log(`[INGESTION] OCR completed for document ${documentId}, ${extractedText.length} chars`);
    } catch (cause) {
        ocrError = cause instanceof Error ? cause.message : 'OCR failed';
        console.error(`[INGESTION] OCR failed for document ${documentId}:`, ocrError);
    }

    // Update OCR status immediately
    await supabase.from('documents').update({
        server_hash: serverHash,
        ocr_text: extractedText,
        ocr_status: ocrStatus,
        ocr_error: ocrError ?? null,
    }).eq('id', documentId);

    // Embedding Phase (only if OCR succeeded and we have text)
    const pageCount = 1;
    let chunkCount = 0;
    let embeddingStatus: 'completed' | 'failed' = 'failed';

    if (ocrStatus === 'completed' && extractedText.trim()) {
        try {
            const chunks = chunkText(extractedText);
            const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
            const rows = chunks.map((chunk, index) => ({
                document_id: document.id,
                case_id: document.case_id,
                chunk_index: index,
                chunk_content: chunk.content,
                token_count: chunk.tokenCount,
                embedding: `[${(embeddings[index] ?? []).join(',')}]`,
                metadata: { fileName: document.file_name },
            }));
            if (rows.length) {
                const { error: chunkError } = await (supabase as any).from('document_chunks').insert(rows);
                if (chunkError) throw chunkError;
            }
            chunkCount = rows.length;
            embeddingStatus = 'completed';
            if (process.env.NODE_ENV === 'development') console.log(`[INGESTION] Embeddings completed for document ${documentId}, ${chunkCount} chunks`);
        } catch (cause) {
            const embedError = cause instanceof Error ? cause.message : 'Embedding failed';
            console.error(`[INGESTION] Embeddings failed for document ${documentId}:`, embedError);
            // Append embed error to ocr_error if needed
            ocrError = ocrError ? `${ocrError} | Embedding: ${embedError}` : embedError;
        }
    } else if (ocrStatus === 'completed') {
        // OCR succeeded but no text extracted
        ocrError = (ocrError ? `${ocrError} | ` : '') + 'No text extracted for embeddings';
    }

    // Final update with embedding status
    await supabase.from('documents').update({
        embedding_status: embeddingStatus,
        chunk_count: chunkCount,
        ocr_error: ocrError ?? null,
    }).eq('id', documentId);

    return {
        documentId,
        pageCount,
        chunkCount,
        ocrStatus,
        embeddingStatus,
        ocrError,
    };
}
