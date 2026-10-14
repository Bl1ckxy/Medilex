// ✓ FILE COMPLETE — analysis-workbench.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle, BrainCircuit, Calculator, CheckCircle2, ChevronRight, Gauge, Loader2, Target } from 'lucide-react';
import { Panel, Button } from '@/components/shared/ui';
import { AuthoritiesCard, DeviationBanner, EngineFactsStrip, type DeviationInfo, type EngineFacts, type GroundingLite } from '@/components/analysis/engine-facts';
import type { CitationCheckLike } from '@/lib/legal/citation-status';
import { formatCurrency } from '@/lib/utils';

type StrengthResult = {
    score?: number;
    label?: string;
    confidence?: number;
    pillars?: Record<string, number>;
    strengths?: string[];
    weaknesses?: string[];
    missingEvidence?: string[];
    nextSteps?: string[];
    authorities?: string[];
    engine?: EngineFacts;
    grounding?: GroundingLite;
    citationCheck?: CitationCheckLike;
    deviation?: DeviationInfo;
};

export function AnalysisWorkbench({ caseId, initialScore }: { caseId: string; initialScore?: number | string | null }) {
    const [result, setResult] = useState<StrengthResult | null>(null);
    const [compensation, setCompensation] = useState<Record<string, unknown> | null>(null);
    const [busy, setBusy] = useState<'strength' | 'compensation' | null>(null);
    const [error, setError] = useState('');

    async function run(type: 'strength' | 'compensation') {
        setBusy(type); setError('');
        try {
            const endpoint = type === 'strength' ? '/api/analyze/strength' : '/api/analysis/compensation';
            const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId }) });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error?.message ?? 'Analysis could not be completed');
            if (type === 'strength') setResult(body.data as StrengthResult);
            else setCompensation(body.data as Record<string, unknown>);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Analysis could not be completed');
        } finally {
            setBusy(null);
        }
    }

    const score = result?.score ?? (initialScore !== null && initialScore !== undefined ? Number(initialScore) : null);
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <Panel className="p-5"><div className="flex items-start justify-between"><div className="rounded-md bg-navy-50 p-2.5 text-navy"><Target className="h-5 w-5" /></div><span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy">AI assist</span></div><h2 className="mt-5 font-serif text-xl font-semibold text-navy">Case strength</h2><p className="mt-2 text-sm leading-6 text-slate-500">Assess evidence, breach, causation, damages and procedural readiness using the records in this matter.</p><Button className="mt-5" onClick={() => void run('strength')} loading={busy === 'strength'}><Gauge className="h-4 w-4" />{score === null ? 'Run assessment' : 'Refresh assessment'}</Button></Panel>
                <Panel className="p-5"><div className="flex items-start justify-between"><div className="rounded-md bg-gold-50 p-2.5 text-gold-600"><BrainCircuit className="h-5 w-5" /></div><span className="rounded-full bg-gold-50 px-2.5 py-1 text-[11px] font-semibold text-gold-600">Indicative</span></div><h2 className="mt-5 font-serif text-xl font-semibold text-navy">Compensation outlook</h2><p className="mt-2 text-sm leading-6 text-slate-500">Generate a transparent range from the case facts. The estimate is not a valuation or legal opinion.</p><Button variant="secondary" className="mt-5" onClick={() => void run('compensation')} loading={busy === 'compensation'}><Calculator className="h-4 w-4" />Estimate compensation</Button></Panel>
            </div>
            {error && <div className="flex items-center gap-2 rounded-md border border-crimson-100 bg-crimson-50 px-4 py-3 text-sm text-crimson"><AlertTriangle className="h-4 w-4" />{error}</div>}
            {result?.engine && <EngineFactsStrip engine={result.engine} />}
            {result?.deviation && <DeviationBanner deviation={result.deviation} />}
            {score !== null && <Panel title="Strength snapshot" description="Use the assessment to guide the next evidence and review decisions."><div className="grid gap-6 p-5 lg:grid-cols-[160px_1fr]"><div className="flex flex-col items-center justify-center rounded-lg bg-navy p-5 text-white"><p className="text-4xl font-semibold">{Math.round(score)}</p><p className="mt-1 text-xs uppercase tracking-wide text-slate-200">{result?.label ?? 'Recorded score'}</p><div className="mt-4 h-1.5 w-full rounded-full bg-white/20"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div></div><div className="space-y-3">{result?.pillars ? Object.entries(result.pillars).map(([name, value]) => <div key={name}><div className="mb-1 flex justify-between text-xs font-medium capitalize text-slate-600"><span>{name}</span><span>{Math.round(value)}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>) : <p className="text-sm text-slate-500">Run an assessment to see the five-part readiness breakdown.</p>}</div></div></Panel>}
            {result && <div className="grid gap-6 lg:grid-cols-2"><Panel title="What supports the matter"><ul className="space-y-3 p-5">{(result.strengths ?? []).map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></Panel><Panel title="Risks and missing evidence"><ul className="space-y-3 p-5">{[...(result.weaknesses ?? []), ...(result.missingEvidence ?? [])].map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-crimson" />{item}</li>)}</ul></Panel></div>}
            {result?.grounding && <AuthoritiesCard grounding={result.grounding} cited={result.authorities ?? []} check={result.citationCheck ?? null} />}
            {compensation && <Panel title="Compensation estimate" description="AI-generated estimate from the current case record."><div className="grid gap-4 p-5 sm:grid-cols-3">{['low', 'midpoint', 'high'].map((key) => <div key={key} className="rounded-md bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</p><p className="mt-2 font-serif text-xl font-semibold text-navy">{typeof compensation[key] === 'number' ? formatCurrency(Number(compensation[key])) : String(compensation[key] ?? '—')}</p></div>)}</div></Panel>}
            {busy && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating a review from the available case material…</div>}
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" /><p>MediLex analysis is an assistive research tool. Confirm authorities, facts and limitation calculations with the responsible lawyer before filing or advising a client.</p></div>
        </div>
    );
}
