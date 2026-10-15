// ✓ FILE COMPLETE — case-detail.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CalendarDays, FileText, Gavel, LayoutDashboard, MoreHorizontal, RefreshCw, Scale, Sparkles, UserRound } from 'lucide-react';
import { useCase } from '@/hooks/use-case';
import { useDocuments } from '@/hooks/use-documents';
import { PageHeader } from '@/components/shared/page-header';
import { Panel, Button } from '@/components/shared/ui';
import { StatusBadge } from '@/components/shared/status-badge';
import { EvidenceVault } from '@/components/evidence/evidence-vault';
import { AnalysisWorkbench } from '@/components/analysis/analysis-workbench';
import { LawyerReviewPanel } from '@/components/review/lawyer-review-panel';
import { OdrWorkspace } from '@/components/odr/odr-workspace';
import { CASE_STATUS_LABELS, CASE_STATUSES, NEGLIGENCE_TYPE_LABELS, SEVERITY_LEVEL_LABELS, type CaseStatus, type NegligenceType, type SeverityLevel } from '@/types/legal';
import { formatCurrency, formatDate } from '@/lib/utils';

type CaseRecord = Record<string, unknown> & { id: string };
type Tab = 'overview' | 'evidence' | 'analysis' | 'review' | 'odr';

function text(item: CaseRecord, snake: string, camel: string, fallback = '—') {
    return String(item[snake] ?? item[camel] ?? fallback);
}

function safeDate(value: unknown) {
    if (!value) return '—';
    try { return formatDate(String(value)); } catch { return '—'; }
}

export function CaseDetail({ caseId }: { caseId: string }) {
    const { caseData, loading, error, refresh } = useCase(caseId);
    const { documents, loading: documentsLoading, refresh: refreshDocuments } = useDocuments(caseId);
    const [tab, setTab] = useState<Tab>('overview');
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');
    const item = caseData as unknown as CaseRecord | null;

    async function updateStatus(value: CaseStatus) {
        setUpdating(true); setUpdateError('');
        const response = await fetch(`/api/cases/${caseId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: value }) });
        if (!response.ok) { const body = await response.json().catch(() => null); setUpdateError(body?.error?.message ?? 'Unable to update stage'); }
        else await refresh();
        setUpdating(false);
    }

    if (loading && !item) return <div className="space-y-6"><div className="h-5 w-36 animate-pulse rounded bg-slate-200" /><div className="h-12 w-3/4 animate-pulse rounded bg-slate-200" /><div className="h-72 animate-pulse rounded-lg bg-white shadow-sm" /></div>;
    if (error || !item) return <Panel className="p-10 text-center"><p className="font-serif text-xl font-semibold text-navy">Matter unavailable</p><p className="mt-2 text-sm text-slate-500">{error || 'This matter could not be found.'}</p><Link href="/dashboard/cases" className="mt-5 inline-flex h-9 items-center rounded-md bg-navy px-3 text-xs font-semibold text-white">Back to cases</Link></Panel>;
    const currentStatus = text(item, 'status', 'status', 'intake') as CaseStatus;
    const negligence = text(item, 'negligence_type', 'negligenceType', 'other') as NegligenceType;
    const severity = text(item, 'severity', 'severity', 'prolonged_suffering') as SeverityLevel;
    const initialScore = (item.ai_strength_score ?? item.aiStrengthScore) as number | string | null | undefined;
    const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'evidence', label: 'Evidence', icon: FileText }, { id: 'analysis', label: 'Analysis', icon: Sparkles }, { id: 'review', label: 'Counsel review', icon: Scale }, { id: 'odr', label: 'ODR & filing', icon: Gavel }];

    return (
        <div className="space-y-6">
            <Link href="/dashboard/cases" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-navy"><ArrowLeft className="h-4 w-4" />Back to cases</Link>
            <PageHeader eyebrow={text(item, 'case_number', 'caseNumber', 'Matter')} title={text(item, 'patient_name', 'patientName', 'Unnamed patient')} description={`${text(item, 'hospital_name', 'hospitalName', 'Hospital not recorded')} · ${text(item, 'hospital_city', 'hospitalCity', 'Location not recorded')}`} action={<div className="flex items-center gap-2"><StatusBadge status={currentStatus} /><button className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="More case actions"><MoreHorizontal className="h-4 w-4" /></button></div>} />
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${tab === id ? 'border-gold text-navy' : 'border-transparent text-slate-500 hover:text-navy'}`}><Icon className="h-4 w-4" />{label}{id === 'evidence' && documents.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[10px]">{documents.length}</span>}</button>)}</div>
            {updateError && <p className="rounded-md border border-crimson-100 bg-crimson-50 px-4 py-3 text-sm text-crimson">{updateError}</p>}
            {tab === 'overview' && <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-6"><Panel title="Matter summary" description="The factual record captured at intake."><div className="grid gap-5 p-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Incident date</p><p className="mt-2 text-sm text-navy">{safeDate(item.incident_date ?? item.incidentDate)}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Negligence type</p><p className="mt-2 text-sm capitalize text-navy">{NEGLIGENCE_TYPE_LABELS[negligence] ?? negligence.replace(/_/g, ' ')}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</p><p className="mt-2 text-sm capitalize text-navy">{SEVERITY_LEVEL_LABELS[severity] ?? severity.replace(/_/g, ' ')}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Claim amount</p><p className="mt-2 text-sm font-semibold text-navy">{formatCurrency(Number(item.claim_amount ?? item.claimAmount ?? 0))}</p></div></div><div className="border-t border-slate-100 px-5 py-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Incident description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{text(item, 'incident_description', 'incidentDescription', 'No incident description recorded.')}</p></div></Panel><Panel title="Hospital and care team"><div className="grid gap-4 p-5 sm:grid-cols-2"><div className="flex gap-3"><div className="rounded-md bg-navy-50 p-2 text-navy"><Gavel className="h-4 w-4" /></div><div><p className="text-sm font-medium text-navy">{text(item, 'hospital_name', 'hospitalName')}</p><p className="mt-1 text-xs capitalize text-slate-500">{text(item, 'hospital_type', 'hospitalType', 'Facility')} · {text(item, 'hospital_state', 'hospitalState')}</p></div></div><div className="flex gap-3"><div className="rounded-md bg-gold-50 p-2 text-gold-600"><UserRound className="h-4 w-4" /></div><div><p className="text-sm font-medium text-navy">{text(item, 'treating_doctor_name', 'treatingDoctorName', 'Treating doctor not recorded')}</p><p className="mt-1 text-xs text-slate-500">{text(item, 'treating_doctor_registration', 'treatingDoctorRegistration', 'Registration not recorded')}</p></div></div></div></Panel></div><div className="space-y-6"><Panel title="Matter stage" description="Move the matter forward as work is completed."><div className="p-5"><label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="case-stage">Current stage</label><select id="case-stage" value={currentStatus} onChange={(event) => void updateStatus(event.target.value as CaseStatus)} disabled={updating} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20">{CASE_STATUSES.map((status) => <option key={status} value={status}>{CASE_STATUS_LABELS[status]}</option>)}</select><p className="mt-3 text-xs leading-5 text-slate-500">Stage changes are shared with your firm workspace.</p></div></Panel><Panel title="Key dates"><div className="space-y-4 p-5"><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-gold-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opened</p><p className="mt-1 text-sm text-navy">{safeDate(item.created_at ?? item.createdAt)}</p></div></div><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-crimson" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Limitation deadline</p><p className="mt-1 text-sm font-semibold text-navy">{safeDate(item.limitation_deadline ?? item.limitationDeadline)}</p></div></div></div></Panel><Button variant="outline" className="w-full" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />Refresh matter</Button></div></div>}
            {tab === 'evidence' && <EvidenceVault caseId={caseId} documents={documents} loading={documentsLoading} onChanged={() => void refreshDocuments()} />}
            {tab === 'analysis' && <AnalysisWorkbench caseId={caseId} initialScore={initialScore} />}
            {tab === 'review' && <LawyerReviewPanel caseId={caseId} />}
            {tab === 'odr' && <OdrWorkspace caseData={item} />}
        </div>
    );
}
