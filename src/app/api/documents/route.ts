import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { UploadDocumentSchema } from '@/types/api';
import { sanitizeFileName } from '@/lib/utils';
import { validateUpload, ValidationError } from '@/lib/validate-upload';
import { sha256, constantTimeEqual } from '@/lib/ai/hash';

export async function GET(request: Request) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const caseId = new URL(request.url).searchParams.get('caseId');
    if (!caseId) return apiError(400, 'VALIDATION_ERROR', 'caseId is required');
    const firmId = profile.firm_id ?? profile.id;
    const { data: caseData, error: caseError } = await (supabase as any).from('cases').select('id').eq('id', caseId).eq('firm_id', firmId).maybeSingle();
    if (caseError) {
        console.error('[API/DOCUMENTS][GET] Case lookup failed', { caseId, firmId, error: caseError.message });
        return apiError(500, 'INTERNAL_ERROR', 'Database query failed');
    }
    if (!caseData) return apiError(404, 'NOT_FOUND', 'Case not found');
    const { data, error } = await (supabase as any).from('documents').select('*').eq('case_id', caseId).order('created_at', { ascending: false });
    if (error) {
        console.error('[API/DOCUMENTS][GET] Database query failed', { caseId, firmId, error: error.message });
        return apiError(500, 'INTERNAL_ERROR', 'Database query failed');
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

    let bytes: Buffer;
    try {
        const validated = await validateUpload(file);
        bytes = validated.buffer;
    } catch (error) {
        if (error instanceof ValidationError) return apiError(error.status, error.code, error.message);
        console.error('[UPLOAD] Unexpected validation failure:', error instanceof Error ? error.message : error);
        return apiError(500, 'INTERNAL_ERROR', 'Failed to validate the uploaded file');
    }
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
        file_name: safeName,
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

    return apiSuccess({ document: data, message: 'Document saved. Processing will run separately.' }, 201);
}
