// ✓ FILE COMPLETE — dashboard-overview.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BriefcaseBusiness, Clock3, FileCheck2, Plus, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Panel } from '@/components/shared/ui';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency, formatDate } from '@/lib/utils';

type DashboardCase = Record<string, unknown> & {
    id: string;
    patient_name?: string;
    patientName?: string;
    case_number?: string;
    caseNumber?: string;
    status?: string;
    claim_amount?: number | string;
    claimAmount?: number | string;
    created_at?: string;
    createdAt?: string;
    limitation_deadline?: string;
};

function asDate(value: unknown) {
    if (!value) return '—';
    try {
        return formatDate(String(value));
    } catch {
        return '—';
    }
}

export function DashboardOverview({ cases, userName }: { cases: DashboardCase[]; userName: string }) {
    const router = useRouter();
    const active = cases.filter((item) => item.status !== 'closed').length;
    const totalValue = cases.reduce((sum, item) => sum + Number(item.claim_amount ?? item.claimAmount ?? 0), 0);
    const pendingEvidence = cases.filter((item) => item.status === 'intake' || item.status === 'investigation').length;
    const deadlines = cases.filter((item) => item.limitation_deadline).length;

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Firm workspace"
                title={`Good morning, ${userName.split(' ')[0]}`}
                description="Keep your medical negligence matters moving with a clear view of deadlines, evidence and next steps."
                action={<Link href="/dashboard/cases/new" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-navy px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700"><Plus className="h-4 w-4" />Open a case</Link>}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Active matters" value={String(active)} detail={`${cases.length} total in workspace`} icon={BriefcaseBusiness} tone="navy" />
                <StatCard label="Claim value" value={formatCurrency(totalValue)} detail="Across visible matters" icon={Activity} tone="gold" />
                <StatCard label="Evidence to review" value={String(pendingEvidence)} detail="Cases in intake or investigation" icon={FileCheck2} tone="green" />
                <StatCard label="Limitation watch" value={String(deadlines)} detail="Matters with a deadline" icon={Clock3} tone="crimson" />
            </div>

            <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 xl:grid-cols-[minmax(0,1fr)_340px]">
                <Panel title="Recent matters" description="The latest activity across your firm" action={<Link href="/dashboard/cases" className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-gold-600 hover:text-gold-500 hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>}>
                    {cases.length === 0 ? (
                        <EmptyState title="No matters yet" description="Create your first matter to start organising patient records and legal analysis." action={<Link href="/dashboard/cases/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-navy px-3 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Open a case</Link>} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px] text-left text-sm">
                                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Patient / matter</th><th className="px-5 py-3 font-semibold">Stage</th><th className="px-5 py-3 font-semibold">Claim value</th><th className="px-5 py-3 font-semibold">Opened</th><th className="px-5 py-3" /></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {cases.slice(0, 8).map((item) => (
                                        <tr key={item.id} onClick={() => router.push(`/dashboard/cases/${item.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') router.push(`/dashboard/cases/${item.id}`); }} tabIndex={0} className="group cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold-500">
                                            <td className="px-5 py-4"><Link href={`/dashboard/cases/${item.id}`} className="font-medium text-navy hover:text-gold-600">{String(item.patient_name ?? item.patientName ?? 'Unnamed patient')}</Link><p className="mt-1 text-xs text-slate-500">{String(item.case_number ?? item.caseNumber ?? 'Matter')} · {String(item.hospital_name ?? 'Medical negligence')}</p></td>
                                            <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                                            <td className="px-5 py-4 font-medium text-navy">{formatCurrency(Number(item.claim_amount ?? item.claimAmount ?? 0))}</td>
                                            <td className="px-5 py-4 text-slate-500">{asDate(item.created_at ?? item.createdAt)}</td>
                                            <td className="px-5 py-4 text-right"><Link href={`/dashboard/cases/${item.id}`} className="text-slate-400 opacity-0 transition group-hover:opacity-100" aria-label="Open matter"><ArrowRight className="h-4 w-4" /></Link></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>

                <Panel title="Your next actions" description="A focused list for today">
                    <div className="space-y-1 p-3">
                        <Link href="/dashboard/cases" className="flex cursor-pointer items-start gap-3 rounded-md p-3 transition hover:bg-slate-50"><span className="mt-0.5 rounded-full bg-gold-50 p-1.5 text-gold-600"><FileCheck2 className="h-3.5 w-3.5" /></span><span><span className="block text-sm font-medium text-navy">Review incoming evidence</span><span className="mt-1 block text-xs leading-5 text-slate-500">{pendingEvidence ? `${pendingEvidence} matters need a first review` : 'Your evidence queue is clear'}</span></span></Link>
                        <Link href="/dashboard/odr" className="flex cursor-pointer items-start gap-3 rounded-md p-3 transition hover:bg-slate-50"><span className="mt-0.5 rounded-full bg-crimson-50 p-1.5 text-crimson"><Clock3 className="h-3.5 w-3.5" /></span><span><span className="block text-sm font-medium text-navy">Check limitation dates</span><span className="mt-1 block text-xs leading-5 text-slate-500">{deadlines ? `${deadlines} deadlines are being monitored` : 'Add a case to begin monitoring'}</span></span></Link>
                        <Link href="/dashboard/cases/new" className="flex cursor-pointer items-start gap-3 rounded-md p-3 transition hover:bg-slate-50"><span className="mt-0.5 rounded-full bg-navy-50 p-1.5 text-navy"><ShieldAlert className="h-3.5 w-3.5" /></span><span><span className="block text-sm font-medium text-navy">Start an intake</span><span className="mt-1 block text-xs leading-5 text-slate-500">Capture facts before the first consultation</span></span></Link>
                    </div>
                </Panel>
            </div>
        </div>
    );
}
