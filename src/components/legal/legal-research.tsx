'use client';

import { useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Loader2, Scale, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Panel, Button } from '@/components/shared/ui';
import { cn } from '@/lib/utils';

type SourceType = 'statute' | 'case' | 'doctrine' | 'guideline' | 'practice';

type Authority = {
    id: string;
    citation: string;
    title: string;
    source_type: SourceType;
    court: string | null;
    year: number | null;
    content: string;
    similarity: number;
};

type Retrieval = {
    chunks: Authority[];
    strategy: 'vector' | 'vector+rerank' | 'lexical-fallback' | 'empty';
    queryEmbeddingMs: number;
    totalMs: number;
};

type CitationVerdict =
    | { status: 'verified'; citation: string; chunkId: string }
    | { status: 'unmatched'; citation: string; suggestion: string | null }
    | { status: 'malformed'; citation: string; reason: string };

type CitationCheck = {
    verdicts: CitationVerdict[];
    verifiedCount: number;
    totalCount: number;
    allVerified: boolean;
} | null;

type AskResult = {
    answer: string | null;
    insufficient: boolean;
    citations: string[];
    confidence?: number;
    citationCheck: CitationCheck;
    retrieval: Retrieval;
    authorities: Authority[];
};

type SearchResult = { chunks: Authority[]; retrieval: Omit<Retrieval, 'chunks'> };

const FILTERS: Array<{ value: SourceType | ''; label: string }> = [
    { value: '', label: 'Any' },
    { value: 'statute', label: 'Statute' },
    { value: 'case', label: 'Case' },
    { value: 'doctrine', label: 'Doctrine' },
    { value: 'guideline', label: 'Guideline' },
    { value: 'practice', label: 'Practice' },
];

const TYPE_STYLES: Record<SourceType, string> = {
    statute: 'bg-navy-50 text-navy',
    case: 'bg-gold-50 text-gold-700',
    doctrine: 'bg-violet-50 text-violet-700',
    guideline: 'bg-emerald-50 text-emerald-700',
    practice: 'bg-sky-50 text-sky-700',
};

function GateStrip({ check }: { check: CitationCheck }) {
    if (!check) return null;
    if (check.totalCount === 0) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                No citations found in the answer — every proposition should carry one.
            </div>
        );
    }
    const bad = check.verdicts.filter((v) => v.status !== 'verified');
    if (check.allVerified) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                {check.verifiedCount}/{check.totalCount} citations verified against retrieved authorities
            </div>
        );
    }
    return (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {check.verifiedCount}/{check.totalCount} — {bad.length} citation{bad.length === 1 ? '' : 's'} removed by the verification gate
            </div>
            <ul className="space-y-1 pl-6">
                {bad.map((verdict, index) => (
                    <li key={index} className="list-disc text-xs">
                        <span className="font-medium">{verdict.citation}</span>
                        {verdict.status === 'unmatched' && verdict.suggestion && (
                            <span className="text-amber-600"> — closest retrieved authority: {verdict.suggestion}</span>
                        )}
                        {verdict.status === 'malformed' && <span className="text-amber-600"> — {verdict.reason}</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function AuthorityCard({ authority }: { authority: Authority }) {
    return (
        <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', TYPE_STYLES[authority.source_type])}>
                    {authority.source_type}
                </span>
                {authority.year !== null && <span className="text-[11px] text-slate-400">{authority.year}</span>}
                <span className="ml-auto text-[11px] text-slate-400" title="Cosine similarity after retrieval">
                    {Math.round(authority.similarity * 100)}%
                </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-navy">{authority.citation}</p>
            <p className="mt-0.5 text-xs text-slate-500">{authority.title}</p>
            <details className="mt-2">
                <summary className="cursor-pointer select-none text-xs text-gold-700 hover:underline">Read passage</summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{authority.content}</p>
            </details>
        </div>
    );
}

function StrategyLine({ retrieval }: { retrieval: Omit<Retrieval, 'chunks'> }) {
    return (
        <p className="text-[11px] text-slate-400">
            Retrieval: {retrieval.strategy} · embedding {retrieval.queryEmbeddingMs} ms · total {retrieval.totalMs} ms
        </p>
    );
}

export function LegalResearch() {
    const [question, setQuestion] = useState('');
    const [filter, setFilter] = useState<SourceType | ''>('');
    const [busy, setBusy] = useState<'ask' | 'search' | null>(null);
    const [error, setError] = useState('');
    const [askResult, setAskResult] = useState<AskResult | null>(null);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

    async function run(mode: 'ask' | 'search') {
        const text = question.trim();
        if (text.length < 2) {
            setError('Enter a question first.');
            return;
        }
        setBusy(mode);
        setError('');
        setAskResult(null);
        setSearchResult(null);
        try {
            const endpoint = mode === 'ask' ? '/api/legal-ask' : '/api/legal-search';
            const payload = mode === 'ask' ? { question: text } : { query: text };
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ...payload, ...(filter ? { matchType: filter } : {}) }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error?.message ?? 'Request could not be completed');
            if (mode === 'ask') setAskResult(body.data as AskResult);
            else setSearchResult(body.data as SearchResult);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Request could not be completed');
        } finally {
            setBusy(null);
        }
    }

    const strategy = askResult?.retrieval ?? searchResult?.retrieval ?? null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl font-semibold text-navy">Legal research</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Ask the curated Indian medical-negligence corpus. Every answer is gated against the authorities retrieval actually returned —
                    citations that fail verification are removed before you see them.
                </p>
            </div>

            <Panel title="Ask the corpus" description="Grounded question answering with a citation-verification gate.">
                <div className="space-y-4 p-5">
                    <textarea
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        rows={3}
                        placeholder="e.g. What is the limitation period for filing a consumer complaint?"
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20"
                        aria-label="Legal question"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {FILTERS.map(({ value, label }) => (
                            <button
                                key={value || 'any'}
                                type="button"
                                onClick={() => setFilter(value)}
                                className={cn(
                                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                    filter === value ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button onClick={() => void run('ask')} loading={busy === 'ask'}>
                            <Scale className="h-4 w-4" />
                            Ask
                        </Button>
                        <Button variant="outline" onClick={() => void run('search')} loading={busy === 'search'}>
                            <Search className="h-4 w-4" />
                            Search only (no AI)
                        </Button>
                    </div>
                </div>
            </Panel>

            {error && (
                <div className="flex items-center gap-2 rounded-md border border-crimson-100 bg-crimson-50 px-4 py-3 text-sm text-crimson">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {busy && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {busy === 'ask' ? 'Retrieving authorities and verifying citations…' : 'Searching the corpus…'}
                </div>
            )}

            {askResult?.insufficient && (
                <Panel>
                    <div className="space-y-3 p-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-navy">
                            <BookOpen className="h-4 w-4 text-gold-600" />
                            The curated corpus does not cover this
                        </div>
                        <p className="text-sm leading-6 text-slate-500">
                            Retrieval found no authority above the similarity floor for this question. Rather than guess a section number or case name,
                            the system reports the gap. Try rephrasing, removing the filter, or asking about consumer-forum procedure, limitation,
                            standard of care, or compensation.
                        </p>
                        {strategy && <StrategyLine retrieval={strategy} />}
                    </div>
                </Panel>
            )}

            {askResult && !askResult.insufficient && askResult.answer && (
                <Panel
                    title="Answer"
                    action={strategy ? <StrategyLine retrieval={strategy} /> : undefined}
                >
                    <div className="space-y-4 p-5">
                        <div className="space-y-3">
                            {askResult.answer.split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence, index) => (
                                <p key={index} className="text-sm leading-6 text-slate-700">
                                    {sentence}
                                </p>
                            ))}
                        </div>
                        <GateStrip check={askResult.citationCheck} />
                    </div>
                </Panel>
            )}

            {(askResult?.authorities?.length ?? 0) > 0 && (
                <Panel title="Retrieved authorities" description="The only sources the answer was allowed to cite.">
                    <div className="grid gap-4 p-5 md:grid-cols-2">
                        {askResult!.authorities.map((authority) => (
                            <AuthorityCard key={authority.id} authority={authority} />
                        ))}
                    </div>
                </Panel>
            )}

            {searchResult && (
                <Panel
                    title={searchResult.chunks.length > 0 ? 'Matching authorities' : 'No matches'}
                    action={searchResult.retrieval.strategy !== 'empty' ? <StrategyLine retrieval={searchResult.retrieval} /> : undefined}
                >
                    {searchResult.chunks.length > 0 ? (
                        <div className="grid gap-4 p-5 md:grid-cols-2">
                            {searchResult.chunks.map((authority) => (
                                <AuthorityCard key={authority.id} authority={authority} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
                            <BookOpen className="h-4 w-4 text-gold-600" />
                            Nothing in the corpus matched — the corpus does not cover this.
                        </div>
                    )}
                </Panel>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                <p>
                    Research support only — this is not legal advice. The corpus is hand-curated (62 authorities) with a published verification log;
                    a licensed advocate must confirm every citation before filing.
                </p>
            </div>
        </div>
    );
}
