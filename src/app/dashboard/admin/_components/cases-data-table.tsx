'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/shared/ui';
import { StatusBadge } from '@/components/shared/status-badge';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { NEGLIGENCE_TYPE_LABELS, type NegligenceType } from '@/types/legal';

interface FirmCase {
    id: string;
    case_number: string;
    patient_name: string;
    hospital_name: string;
    negligence_type: string;
    claim_amount: number | string;
    status: string;
    created_at: string;
}

export function CasesData() {
    const [cases, setCases] = useState<FirmCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [rerunning, setRerunning] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function fetchCases() {
            const supabase = createSupabaseBrowserClient();
            const { data, error } = await supabase
                .from('cases')
                .select('id, case_number, patient_name, hospital_name, negligence_type, claim_amount, status, created_at')
                .order('created_at', { ascending: false });
            if (cancelled) return;
            if (error) {
                console.error('[ADMIN] Failed to load cases:', error.message);
                toast.error('Failed to load cases');
                setCases([]);
            } else {
                setCases((data ?? []) as FirmCase[]);
            }
            setLoading(false);
        }
        void fetchCases();
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleRerunAnalysis(caseId: string) {
        setRerunning(caseId);
        try {
            const res = await fetch('/api/analysis/strength', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseId }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
            }
            toast.success('Analysis re-run successfully');
        } catch (e) {
            toast.error(`Failed to re-run analysis: ${e instanceof Error ? e.message : 'unknown error'}`);
        }
        setRerunning(null);
    }

    if (loading) {
        return (
            <div className="flex h-48 items-center justify-center text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> Loading case data…
            </div>
        );
    }

    if (cases.length === 0) {
        return (
            <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Firm Cases</h3>
                <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    No cases visible to this account yet. Create one from Cases to see oversight here.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Firm Cases</h3>
                <div className="text-xs italic text-slate-400">Chain of custody enforced: Deletion disabled</div>
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b bg-slate-50">
                        <tr>
                            <th className="p-3 text-left font-semibold text-slate-500">Case / patient</th>
                            <th className="p-3 text-left font-semibold text-slate-500">Type</th>
                            <th className="p-3 text-left font-semibold text-slate-500">Status</th>
                            <th className="p-3 text-right font-semibold text-slate-500">Claim value</th>
                            <th className="p-3 text-right font-semibold text-slate-500">Created</th>
                            <th className="p-3 text-right font-semibold text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cases.map((c) => (
                            <tr key={c.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50">
                                <td className="p-3">
                                    <div className="font-serif font-medium text-navy">{c.patient_name}</div>
                                    <div className="text-xs text-slate-500">
                                        {c.case_number} · {c.hospital_name}
                                    </div>
                                </td>
                                <td className="p-3">
                                    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-navy-100 bg-navy-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-navy">
                                        {NEGLIGENCE_TYPE_LABELS[c.negligence_type as NegligenceType] ?? c.negligence_type.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <StatusBadge status={c.status} />
                                </td>
                                <td className="p-3 text-right font-semibold tabular-nums text-navy">
                                    {formatCurrency(Number(c.claim_amount) || 0)}
                                </td>
                                <td className="p-3 text-right tabular-nums text-slate-500">{formatDate(c.created_at)}</td>
                                <td className="p-3 text-right">
                                    <Button variant="ghost" size="sm" onClick={() => void handleRerunAnalysis(c.id)} disabled={rerunning === c.id}>
                                        {rerunning === c.id ? (
                                            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                                        ) : (
                                            <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
                                        )}
                                        Re-run
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
