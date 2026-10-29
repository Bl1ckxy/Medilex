import type { NextRequest } from 'next/server';
import { CreateCaseSchema } from '@/types/api';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { calculateLimitationDeadline, getRecommendedForum } from '@/lib/legal';

export async function GET(request: NextRequest) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const requestedPage = Number(request.nextUrl.searchParams.get('page') ?? 1);
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 20;
    const query = (request.nextUrl.searchParams.get('search') ?? request.nextUrl.searchParams.get('q'))?.slice(0, 200);
    const status = request.nextUrl.searchParams.get('status');
    const forum = request.nextUrl.searchParams.get('forum') ?? request.nextUrl.searchParams.get('recommendedForum');
    let builder = (supabase as any).from('cases').select('*', { count: 'exact' }).eq('firm_id', profile.firm_id ?? profile.id);
    if (query) {
        const safeQuery = query.replace(/[(),]/g, '');
        if (safeQuery) {
            builder = builder.or(`patient_name.ilike.%${safeQuery}%,case_number.ilike.%${safeQuery}%,hospital_name.ilike.%${safeQuery}%`);
        }
    }
    if (status) builder = builder.eq('status', status);
    if (forum) builder = builder.eq('recommended_forum', forum);
    const { data, count, error } = await builder.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (error) {
        console.error('[API/CASES][GET] Database query failed', {
            firmId: profile.firm_id ?? profile.id,
            error: error.message,
        });
        return apiError(500, 'INTERNAL_ERROR', 'Database query failed');
    }
    return apiSuccess({ items: data ?? [], pagination: { total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) } });
}

export async function POST(request: Request) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = CreateCaseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Invalid case details', parsed.error.flatten());
    const input = parsed.data; const incidentDate = new Date(input.incidentDate);
    const { data, error } = await (supabase as any).from('cases').insert({
        incident_date: incidentDate.toISOString(), claim_amount: input.claimAmount,
        patient_name: input.patientName, patient_age: input.patientAge, patient_gender: input.patientGender,
        next_of_kin: input.nextOfKin, next_of_kin_relation: input.nextOfKinRelation,
        hospital_name: input.hospitalName, hospital_type: input.hospitalType,
        hospital_city: input.hospitalCity, hospital_state: input.hospitalState, negligence_type: input.negligenceType,
        severity: input.severity, incident_description: input.incidentDescription,
        limitation_deadline: calculateLimitationDeadline(incidentDate).toISOString(),
        treating_doctor_name: input.treatingDoctorName,
        treating_doctor_registration: input.treatingDoctorRegistration,
        recommended_forum: getRecommendedForum(input.claimAmount), created_by: profile.id, firm_id: profile.firm_id ?? profile.id,
    }).select().single();
    if (error) {
        console.error('[API/CASES][POST] Database insert failed', {
            firmId: profile.firm_id ?? profile.id,
            error: error.message,
        });
        return apiError(500, 'INTERNAL_ERROR', 'Database insert failed');
    }
    return apiSuccess(data, 201);
}
