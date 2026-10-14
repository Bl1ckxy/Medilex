import type { NextRequest } from 'next/server';
import { UpdateCaseSchema } from '@/types/api';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { getMockCase } from '@/mock';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const { data, error } = await (supabase as any).from('cases').select('*, documents(*)').eq('id', params.id).eq('firm_id', profile.firm_id ?? profile.id).single();
    if (error || !data) {
        const mockData = getMockCase(params.id);
        if (!mockData) return apiError(404, 'NOT_FOUND', 'Case not found');
        const formattedMock: any = {
            id: mockData.id,
            case_number: mockData.case_number,
            patient_name: mockData.patient_name,
            patientAge: mockData.patientAge,
            patientGender: mockData.patientGender,
            hospitalName: mockData.hospitalName,
            hospitalType: mockData.hospitalType,
            hospitalCity: mockData.hospitalCity,
            hospitalState: mockData.hospitalState,
            negligenceType: mockData.negligenceType,
            severity: mockData.severity,
            incidentDate: mockData.incidentDate,
            incidentDescription: mockData.incidentDescription,
            claimAmount: mockData.claimAmount,
            nextOfKin: mockData.nextOfKin,
            nextOfKinRelation: mockData.nextOfKinRelation,
            treatingDoctorName: mockData.treatingDoctorName,
            treatingDoctorRegistration: mockData.treatingDoctorRegistration,
            status: mockData.status,
            assignedTo: mockData.assignedTo,
            filedForum: mockData.filedForum,
            complaintNumber: mockData.complaintNumber,
            createdAt: mockData.createdAt,
            firmId: mockData.firmId,
            createdBy: mockData.createdBy,
            limitationDeadline: mockData.limitation_deadline,
            aiStrengthScore: mockData.aiStrengthScore,
            aiAnalysisCompleted: mockData.aiAnalysisCompleted,
            documents: [],
        };
        return apiSuccess(formattedMock);
    }
    return apiSuccess(data);
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = UpdateCaseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Invalid case update', parsed.error.flatten());
    const firmId = profile.firm_id ?? profile.id;
    const values: Record<string, unknown> = { ...parsed.data };
    if ('assignedTo' in values) {
        const { data: assignee } = await (supabase as any)
            .from('users')
            .select('id')
            .eq('id', values.assignedTo)
            .eq('firm_id', firmId)
            .maybeSingle();
        if (!assignee) return apiError(422, 'VALIDATION_ERROR', 'The assignee must belong to your firm');
        values.assigned_to = values.assignedTo;
        delete values.assignedTo;
    }
    if ('incidentDescription' in values) { values.incident_description = values.incidentDescription; delete values.incidentDescription; }
    if ('filedForum' in values) { values.filed_forum = values.filedForum; delete values.filedForum; }
    if ('complaintNumber' in values) { values.complaint_number = values.complaintNumber; delete values.complaintNumber; }
    const { data, error } = await (supabase as any).from('cases').update(values).eq('id', params.id).eq('firm_id', firmId).select().single();
    if (error || !data) return apiError(404, 'NOT_FOUND', 'Case not found');
    return apiSuccess(data);
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const firmId = profile.firm_id ?? profile.id;
    const { data: caseData, error: lookupError } = await (supabase as any)
        .from('cases')
        .select('id,documents(storage_path)')
        .eq('id', params.id)
        .eq('firm_id', firmId)
        .maybeSingle();
    if (lookupError) return apiError(500, 'INTERNAL_ERROR', lookupError.message);
    if (!caseData) return apiError(404, 'NOT_FOUND', 'Case not found');
    const paths = (caseData.documents ?? [])
        .map((document: { storage_path?: unknown }) => document.storage_path)
        .filter((path: unknown): path is string => typeof path === 'string' && path.length > 0);
    if (paths.length) {
        const { error: storageError } = await supabase.storage.from('case-documents').remove(paths);
        if (storageError) return apiError(500, 'INTERNAL_ERROR', storageError.message);
    }
    const { error } = await (supabase as any).from('cases').delete().eq('id', params.id).eq('firm_id', firmId).select('id').single();
    if (error) return apiError(500, 'INTERNAL_ERROR', error.message);
    return apiSuccess({ deleted: true });
}
