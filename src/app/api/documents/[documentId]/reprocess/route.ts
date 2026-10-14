import { apiError, apiSuccess } from '@/lib/api';
import { ingestDocument } from '@/lib/ai/ingestion';
import { getProfile } from '@/lib/server-user';

export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: { documentId: string } }) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const { data: document, error } = await (supabase as any)
        .from('documents')
        .select('id,client_hash,cases!inner(firm_id)')
        .eq('id', params.documentId)
        .eq('cases.firm_id', profile.firm_id ?? profile.id)
        .single();
    if (error || !document) return apiError(404, 'NOT_FOUND', 'Document not found');
    try {
        const result = await ingestDocument(document.id, document.client_hash);
        return apiSuccess(result);
    } catch (cause) {
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
        const message = cause instanceof Error ? cause.message : 'Document reprocessing failed';
        return apiError(502, 'OCR_FAILED', message);
    }
}
