import { apiError, apiSuccess } from '@/lib/api';
import { ingestDocument } from '@/lib/ai/ingestion';
import { getProfile } from '@/lib/server-user';

export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: { documentId: string } }) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const firmId = profile.firm_id ?? profile.id;
    const { data: document, error } = await (supabase as any)
        .from('documents')
        .select('id,client_hash,ocr_status,cases!inner(firm_id)')
        .eq('id', params.documentId)
        .eq('cases.firm_id', firmId)
        .single();
    if (error || !document) return apiError(404, 'NOT_FOUND', 'Document not found');
    if (document.ocr_status === 'processing') return apiError(409, 'CONFLICT', 'Document is already being processed');
    try {
        const result = await ingestDocument(document.id, document.client_hash);
        return apiSuccess(result);
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Document processing failed';
        console.error('[API/DOCUMENTS/PROCESS] Processing failed', { documentId: params.documentId, firmId, error: message });
        return apiError(502, 'OCR_FAILED', 'Document processing failed');
    }
}
