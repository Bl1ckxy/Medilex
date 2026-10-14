'use client';

import { useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Copy, Loader2, Scale, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { toast } from 'sonner';
import { Panel, Button, Skeleton } from '@/components/shared/ui';
import { cn } from '@/lib/utils';
import {
    GATE_BADGE_STYLES,
    GATE_DOT_STYLES,
    GATE_LABELS,
    gateStatusForMarker,
    type CitationCheckLike,
} from '@/lib/legal/citation-status';

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

type AskResult = {
    answer: string | null;
    insufficient: boolean;
    citations: string[];
    confidence?: number;
    citationCheck: CitationCheckLike;
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
    case: 'bg-gold-50 text-gold-600',
    doctrine: 'bg-violet-50 text-violet-700',
    guideline: 'bg-emerald-50 text-emerald-700',
    practice: 'bg-sky-50 text-sky-700',
};

const SUGGESTED_QUESTIONS = [
    'What is the limitation period for filing a consumer complaint?',
    'Which forum hears a claim above Rs. 50 lakhs?',
    'What standard of care do hospitals owe patients?',
    'What compensation heads apply to permanent disability?',
];

function GateStrip({ check }: { check: CitationCheckLike }) {
    if (!check) return null;
    if (check.totalCount === 0) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-gold-200 bg-gold-50 px-3 py-2.5 text-xs leading-5 text-slate-700">
                <ShieldAlert className="h-4 w-4 shrink-0 text-gold-600" />
                No citations found in the answer — every proposition of law should carry one.
            </div>
        );
    }
    const bad = check.verdicts.filter((v) => v.status !== 'verified');
    if (check.allVerified) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-800">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                {check.verifiedCount}/{check.totalCount} citations verified against the retrieved authorities
            </div>
        );
    }
    return (
        <div className="space-y-2 rounded-md border border-gold-200 bg-gold-50 px-3 py-2.5 text-xs leading-5 text-slate-700">
            <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-gold-600" />
                <span className="font-semibold text-navy">
                    {check.verifiedCount}/{check.totalCount} verified
                </span>
                <span>— {bad.length} citation{bad.length === 1 ? '' : 's'} failed the gate and were removed</span>
            </div>
            <ul className="space-y-1 pl-6">
                {bad.map((verdict, index) => (
                    <li key={index} className="list-disc">
                        <span className="font-serif font-medium text-navy">{verdict.citation}</span>
                        {verdict.status === 'unmatched' && verdict.suggestion && <span> — closest retrieved authority: {verdict.suggestion}</span>}
                        {verdict.status === 'malformed' && <span> — {verdict.reason}</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function CitationMarker({ marker, citation, check, authorities }: { marker: number; citation: string | null; check: CitationCheckLike; authorities: Authority[] }) {
    const authority = authorities[marker - 1] ?? null;
    const gate = gateStatusForMarker(marker, citation, check);
    return (
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                <button
                    type="button"
                    className={cn('mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 align-baseline text-[10px] font-semibold tabular-nums transition-colors', GATE_BADGE_STYLES[gate.status])}
                    aria-label={`Citation ${marker}: ${GATE_LABELS[gate.status]}`}
                >
                    {marker}
                </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    side="top"
                    align="center"
                    collisionPadding={8}
                    className="z-50 w-80 rounded-md border border-navy-600 bg-navy p-3 text-left shadow-lg"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Authority {marker}</span>
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold', GATE_BADGE_STYLES[gate.status])}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', GATE_DOT_STYLES[gate.status])} aria-hidden="true" />
                            {GATE_LABELS[gate.status]}
                        </span>
                    </div>
                    {authority ? (
                        <div className="mt-2 space-y-1">
                            <p className="font-serif text-[13px] font-semibold leading-5 text-ivory">{authority.citation}</p>
                            <p className="text-[11px] leading-4 text-slate-300">{authority.title}</p>
                            <p className="text-[11px] leading-4 text-slate-300">{gate.note}</p>
                            <p className="text-[10px] leading-4 text-slate-400">
                                {authority.source_type}
                                {authority.court ? ` · ${authority.court}` : ''}
                                {authority.year ? ` · ${authority.year}` : ''} · similarity {Math.round(authority.similarity * 100)}%
                            </p>
                        </div>
                    ) : (
                        <p className="mt-2 text-[11px] leading-4 text-slate-300">No retrieved authority sits behind this reference.</p>
                    )}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}

function SourceRow({ authority, index }: { authority: Authority; index: number }) {
    const pct = Math.max(0, Math.round(authority.similarity * 100));
    return (
        <li className="rounded-md border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                    <span className="rounded border border-navy-100 bg-navy-50 px-1.5 py-px text-[10px] font-semibold tabular-nums text-navy">{index + 1}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TYPE_STYLES[authority.source_type])}>{authority.source_type}</span>
                </span>
                <span className="text-[11px] font-medium tabular-nums text-slate-500" title="Cosine similarity to the query">
                    {pct}%
                </span>
            </div>
            <p className="mt-2 font-serif text-[13px] font-semibold leading-5 text-navy">{authority.citation}</p>
            <p className="mt-0.5 text-xs leading-4 text-slate-500">{authority.title}</p>
            <div className="mt-2 h-1 rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-1 rounded-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <details className="mt-2">
                <summary className="cursor-pointer select-none text-xs font-medium text-gold-600 hover:underline">Read passage</summary>
                <p className="mt-2 text-xs leading-5 text-slate-600">{authority.content}</p>
            </details>
        </li>
    );
}

function StrategyLine({ retrieval }: { retrieval: Omit<Retrieval, 'chunks'> }) {
    return (
        <p className="text-[11px] tabular-nums text-slate-400">
            Retrieval: {retrieval.strategy} · embedding {retrieval.queryEmbeddingMs} ms · total {retrieval.totalMs} ms
        </p>
    );
}

function Synthesis({ result }: { result: AskResult }) {
    const paragraphs = (result.answer ?? '').split(/\n{2,}/).filter(Boolean);
    return (
        <div className="space-y-4 p-5">
            <div className="space-y-3 font-serif text-[15px] leading-7 text-slate-700">
                {paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>
                        {paragraph.split(/(\[\d{1,2}\])/g).map((part, partIndex) => {
                            const match = part.match(/^\[(\d{1,2})\]$/);
                            if (!match) return <span key={partIndex}>{part}</span>;
                            const marker = Number(match[1]);
                            return (
                                <CitationMarker
                                    key={partIndex}
                                    marker={marker}
                                    citation={result.authorities[marker - 1]?.citation ?? null}
                                    check={result.citationCheck}
                                    authorities={result.authorities}
                                />
                            );
                        })}
                    </p>
                ))}
            </div>
            <GateStrip check={result.citationCheck} />
        </div>
    );
}

function ResultRow({ authority }: { authority: Authority }) {
    const pct = Math.max(0, Math.round(authority.similarity * 100));
    return (
        <li className="border-b border-slate-100 px-5 py-4 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TYPE_STYLES[authority.source_type])}>{authority.source_type}</span>
                {authority.year !== null && <span className="text-[11px] tabular-nums text-slate-400">{authority.year}</span>}
                <span className="ml-auto text-[11px] font-medium tabular-nums text-slate-500" title="Cosine similarity to the query">
                    {pct}%
                </span>
            </div>
            <p className="mt-1.5 font-serif text-sm font-semibold text-navy">{authority.citation}</p>
            <p className="mt-0.5 text-xs text-slate-500">{authority.title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{authority.content}</p>
        </li>
    );
}

export function LegalResearch() {
    const [mode, setMode] = useState<'ask' | 'search'>('ask');
    const [question, setQuestion] = useState('');
    const [filter, setFilter] = useState<SourceType | ''>('');
    const [busy, setBusy] = useState<'ask' | 'search' | null>(null);
    const [error, setError] = useState('');
    const [askResult, setAskResult] = useState<AskResult | null>(null);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

    async function run() {
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

    const retrieved = askResult?.authorities ?? searchResult?.chunks ?? [];
    const strategy = askResult?.retrieval ?? searchResult?.retrieval ?? null;

    return (
        <Tooltip.Provider delayDuration={150}>
            <div className="space-y-6">
                <div>
                    <h1 className="font-serif text-2xl font-semibold text-navy">Legal research</h1>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                        Ask the curated Indian medical-negligence corpus. Every answer is gated against the authorities retrieval actually returned —
                        citations that fail verification are removed before you see them.
                    </p>
                </div>

                <div className="grid items-start gap-5 lg:grid-cols-[3fr_7fr]">
                    <div className="space-y-5 lg:sticky lg:top-4">
                        <Panel title="Research query">
                            <div className="space-y-3 p-4">
                                <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Research mode">
                                    <button
                                        type="button"
                                        aria-pressed={mode === 'ask'}
                                        onClick={() => setMode('ask')}
                                        className={cn(
                                            'rounded px-2 py-2 text-xs font-semibold transition-colors',
                                            mode === 'ask' ? 'bg-navy text-white shadow-sm' : 'text-slate-600 hover:text-navy',
                                        )}
                                    >
                                        Ask
                                        <span className={cn('mt-0.5 block text-[10px] font-normal', mode === 'ask' ? 'text-slate-300' : 'text-slate-400')}>AI synthesis</span>
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={mode === 'search'}
                                        onClick={() => setMode('search')}
                                        className={cn(
                                            'rounded px-2 py-2 text-xs font-semibold transition-colors',
                                            mode === 'search' ? 'bg-navy text-white shadow-sm' : 'text-slate-600 hover:text-navy',
                                        )}
                                    >
                                        Search only (no AI)
                                        <span className={cn('mt-0.5 block text-[10px] font-normal', mode === 'search' ? 'text-slate-300' : 'text-slate-400')}>retrieval only</span>
                                    </button>
                                </div>
                                <textarea
                                    value={question}
                                    onChange={(event) => setQuestion(event.target.value)}
                                    rows={4}
                                    placeholder="e.g. What is the limitation period for filing a consumer complaint?"
                                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20"
                                    aria-label="Legal question"
                                />
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Source type filter">
                                    {FILTERS.map(({ value, label }) => (
                                        <button
                                            key={value || 'any'}
                                            type="button"
                                            aria-pressed={filter === value}
                                            onClick={() => setFilter(value)}
                                            className={cn(
                                                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                                                filter === value ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <Button className="w-full" onClick={() => void run()} loading={busy !== null}>
                                    {mode === 'ask' ? <Scale className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                                    {mode === 'ask' ? 'Run research' : 'Search corpus'}
                                </Button>
                                <div>
                                    <p className="text-[11px] font-medium text-slate-500">Suggested questions</p>
                                    <div className="mt-1.5 flex flex-col gap-1">
                                        {SUGGESTED_QUESTIONS.map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() => setQuestion(suggestion)}
                                                className="rounded-md border border-transparent px-2 py-1.5 text-left text-xs leading-4 text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-navy"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        <Panel title="Retrieved authorities" action={<span className="text-[11px] tabular-nums text-slate-400">{retrieved.length} chunks</span>}>
                            <div className="p-4">
                                {busy ? (
                                    <div className="space-y-3">
                                        {[0, 1, 2].map((item) => (
                                            <div key={item} className="space-y-2 rounded-md border border-slate-100 p-3">
                                                <Skeleton className="h-3 w-20" />
                                                <Skeleton className="h-4 w-3/4" />
                                                <Skeleton className="h-3 w-1/2" />
                                            </div>
                                        ))}
                                    </div>
                                ) : retrieved.length > 0 ? (
                                    <ul className="space-y-3">
                                        {retrieved.map((authority, index) => (
                                            <SourceRow key={authority.id} authority={authority} index={index} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                                        Nothing retrieved yet — run a query to see the raw corpus chunks and similarity scores the synthesis draws on.
                                    </div>
                                )}
                            </div>
                        </Panel>
                    </div>

                    <div className="min-w-0 space-y-5">
                        {error && (
                            <div className="flex items-center gap-2 rounded-md border border-crimson-100 bg-crimson-50 px-4 py-3 text-sm text-crimson-600" role="alert">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {busy && (
                            <Panel title={mode === 'ask' ? 'Synthesis' : 'Corpus matches'}>
                                <div className="space-y-4 p-5">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        {mode === 'ask' ? 'Retrieving authorities and verifying citations…' : 'Searching the corpus…'}
                                    </div>
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-11/12" />
                                    <Skeleton className="h-4 w-4/5" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            </Panel>
                        )}

                        {!busy && askResult?.insufficient && (
                            <Panel title="Corpus gap">
                                <div className="space-y-3 p-5">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-navy">
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

                        {!busy && askResult && !askResult.insufficient && askResult.answer && (
                            <Panel
                                title="Synthesis"
                                description="Serif prose is AI synthesis; each numbered chip is a gated citation — hover it for the verification state."
                                action={
                                    <div className="flex items-center gap-3">
                                        {strategy && <StrategyLine retrieval={strategy} />}
                                        <Button variant="ghost" size="sm" onClick={() => void (async () => { await navigator.clipboard.writeText(askResult.answer ?? ''); toast.success('Synthesis copied to clipboard'); })()}>
                                            <Copy className="h-3.5 w-3.5" />
                                            Copy
                                        </Button>
                                    </div>
                                }
                            >
                                <Synthesis result={askResult} />
                            </Panel>
                        )}

                        {!busy && searchResult && (
                            <Panel
                                title={searchResult.chunks.length > 0 ? 'Corpus matches' : 'No matches'}
                                description={searchResult.chunks.length > 0 ? 'Pure retrieval — no AI text between you and the corpus.' : undefined}
                                action={searchResult.retrieval.strategy !== 'empty' ? <StrategyLine retrieval={searchResult.retrieval} /> : undefined}
                            >
                                {searchResult.chunks.length > 0 ? (
                                    <ul>
                                        {searchResult.chunks.map((authority) => (
                                            <ResultRow key={authority.id} authority={authority} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex items-start gap-2 p-5 text-sm leading-6 text-slate-500">
                                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                                        Nothing in the corpus matched — the corpus does not cover this.
                                    </div>
                                )}
                            </Panel>
                        )}

                        {!busy && !error && !askResult && !searchResult && (
                            <Panel title="Synthesis">
                                <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                                    <BookOpen className="h-6 w-6 text-gold-600" />
                                    <p className="text-sm font-semibold text-navy">No synthesis yet</p>
                                    <p className="max-w-md text-xs leading-5 text-slate-500">
                                        Ask a question to generate a gated synthesis — numbered chips show each citation&apos;s verification state on hover.
                                        Search mode returns raw corpus matches with no AI in between.
                                    </p>
                                </div>
                            </Panel>
                        )}
                    </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                    <p>
                        Research support only — this is not legal advice. The corpus is hand-curated (60 authorities) with a published verification log;
                        a licensed advocate must confirm every citation before filing.
                    </p>
                </div>
            </div>
        </Tooltip.Provider>
    );
}
