import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { UploadDocumentSchema } from '@/types/api';
import { sanitizeFileName } from '@/lib/utils';
import { sha256, constantTimeEqual } from '@/lib/ai/hash';
import { ingestDocument, type IngestionResult } from '@/lib/ai/ingestion';
import { getMockDocumentsForCase } from '@/mock';

export const maxDuration = 60;

export async function GET(request: Request) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const caseId = new URL(request.url).searchParams.get('caseId');
    if (!caseId) return apiError(400, 'VALIDATION_ERROR', 'caseId is required');
    const firmId = profile.firm_id ?? profile.id;
    const { data: caseData, error: caseError } = await (supabase as any).from('cases').select('id').eq('id', caseId).eq('firm_id', firmId).maybeSingle();
    if (caseError) return apiError(500, 'INTERNAL_ERROR', caseError.message);
    const { data, error } = await (supabase as any).from('documents').select('*').eq('case_id', caseId).order('created_at', { ascending: false });
    if (error) {
        const mockDocs = getMockDocumentsForCase(caseId);
        return apiSuccess(mockDocs);
    }
    if (!data || data.length === 0) {
        const mockDocs = getMockDocumentsForCase(caseId);
        if (mockDocs.length) return apiSuccess(mockDocs);
    }
    return apiSuccess(data ?? []);
}

export async function POST(request: Request) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return apiError(400, 'VALIDATION_ERROR', 'A valid multipart form is required');
    }

    const file = form.get('file');
    const input = UploadDocumentSchema.safeParse({
        caseId: form.get('caseId'),
        documentCategory: form.get('documentCategory'),
        clientHash: form.get('clientHash'),
    });

    if (!input.success || !(file instanceof File)) {
        return apiError(422, 'VALIDATION_ERROR', 'A valid file and document details are required', input.success ? undefined : input.error.flatten());
    }

    const firmId = profile.firm_id ?? profile.id;
    const { data: caseData, error: caseError } = await (supabase as any).from('cases').select('id').eq('id', input.data.caseId).eq('firm_id', firmId).maybeSingle();
    if (caseError) return apiError(500, 'INTERNAL_ERROR', caseError.message);
    if (!caseData) return apiError(404, 'NOT_FOUND', 'Case not found');

    if (file.size > 25 * 1024 * 1024) return apiError(413, 'FILE_TOO_LARGE', 'Files must be 25 MB or smaller');
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        return apiError(415, 'UNSUPPORTED_FORMAT', 'Only PDF, PNG, JPEG and WebP files are supported');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!constantTimeEqual(sha256(bytes), input.data.clientHash)) {
        return apiError(422, 'HASH_MISMATCH', 'The uploaded file hash does not match clientHash');
    }

    const { data: existing } = await (supabase as any)
        .from('documents')
        .select('id')
        .eq('case_id', input.data.caseId)
        .eq('client_hash', input.data.clientHash)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (existing) return apiSuccess({ duplicate: true, existingDocumentId: existing.id });

    const safeName = sanitizeFileName(file.name) || 'document';
    const path = `${input.data.caseId}/${crypto.randomUUID()}-${safeName}`;

    const upload = await supabase.storage.from('case-documents').upload(path, bytes, { contentType: file.type, upsert: false });
    if (upload.error) return apiError(500, 'INTERNAL_ERROR', upload.error.message);

    const { data, error } = await (supabase as any).from('documents').insert({
        case_id: input.data.caseId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
        category: input.data.documentCategory,
        uploaded_by: profile.id,
        client_hash: input.data.clientHash,
        ocr_status: 'pending',
        embedding_status: 'pending',
    }).select().single();

    if (error) {
        await supabase.storage.from('case-documents').remove([path]);
        if (error.code === '23505') {
            const { data: duplicate } = await (supabase as any)
                .from('documents')
                .select('id')
                .eq('case_id', input.data.caseId)
                .eq('client_hash', input.data.clientHash)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            if (duplicate) return apiSuccess({ duplicate: true, existingDocumentId: duplicate.id });
        }
        return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    // Run ingestion - NEVER throw AI errors, always return success if file+DB saved
    let ingestion: IngestionResult;
    try {
        ingestion = await ingestDocument(data.id, input.data.clientHash);
    } catch (cause) {
        // This should only happen for hash mismatch or document not found
        const message = cause instanceof Error ? cause.message : 'Document ingestion failed';
        const isTimeout = cause instanceof Error && (
            cause.name === 'AbortError' ||
            cause.name === 'TimeoutError' ||
            cause.message.toLowerCase().includes('timeout') ||
            cause.message.toLowerCase().includes('timed out') ||
            cause.message.toLowerCase().includes('aborted')
        );
        if (isTimeout) {
            return apiError(
                504,
                'OCR_FAILED',
                'Document processing timed out. The file was uploaded successfully — retry processing from the Evidence tab.',
                { retryable: true },
            );
        }
        console.error('[UPLOAD] Ingestion threw unexpectedly:', message);
        ingestion = {
            documentId: data.id,
            pageCount: 1,
            chunkCount: 0,
            ocrStatus: 'failed',
            embeddingStatus: 'failed',
            ocrError: message,
        };
    }

    // Always return success if file and document row were saved
    const message = ingestion.ocrStatus === 'failed' || ingestion.embeddingStatus === 'failed'
        ? 'Document saved. AI processing completed with errors (check status).'
        : 'Document saved and AI processing completed.';

    return apiSuccess({
        document: data,
        ingestion,
        message,
    }, 201);
}
