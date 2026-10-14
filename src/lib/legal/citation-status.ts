export type GateStatus = 'verified' | 'partial' | 'unverified' | 'uncited';

export type GateVerdictLike =
    | { status: 'verified'; citation: string }
    | { status: 'unmatched'; citation: string; suggestion: string | null }
    | { status: 'malformed'; citation: string; reason: string };

export type CitationCheckLike = {
    verdicts: GateVerdictLike[];
    verifiedCount: number;
    totalCount: number;
    allVerified: boolean;
} | null;

export const GATE_LABELS: Record<GateStatus, string> = {
    verified: 'Verified',
    partial: 'Partial',
    unverified: 'Unverified',
    uncited: 'Retrieved',
};

export const GATE_DESCRIPTIONS: Record<GateStatus, string> = {
    verified: 'Matched verbatim against a retrieved corpus authority.',
    partial: 'Nearest match only — confirm the exact citation before relying on it.',
    unverified: 'Not present in the retrieved set — removed by the citation gate.',
    uncited: 'In the retrieved set but not named in the synthesis.',
};

export const GATE_BADGE_STYLES: Record<GateStatus, string> = {
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    partial: 'border-gold-200 bg-gold-50 text-gold-600',
    unverified: 'border-crimson-100 bg-crimson-50 text-crimson-600',
    uncited: 'border-slate-200 bg-slate-50 text-slate-500',
};

export const GATE_DOT_STYLES: Record<GateStatus, string> = {
    verified: 'bg-emerald-600',
    partial: 'bg-gold-500',
    unverified: 'bg-crimson',
    uncited: 'bg-slate-400',
};

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

function verdictFor(citation: string, check: CitationCheckLike): GateVerdictLike | null {
    if (!check) return null;
    const target = normalize(citation);
    return check.verdicts.find((verdict) => normalize(verdict.citation) === target) ?? null;
}

export function gateStatusForCitation(citation: string, check: CitationCheckLike): { status: GateStatus; note: string } {
    if (!check) return { status: 'uncited', note: 'No citation gate ran for this analysis.' };
    const verdict = verdictFor(citation, check);
    if (!verdict) return { status: 'uncited', note: GATE_DESCRIPTIONS.uncited };
    if (verdict.status === 'verified') return { status: 'verified', note: GATE_DESCRIPTIONS.verified };
    if (verdict.status === 'unmatched' && verdict.suggestion) {
        return { status: 'partial', note: `No exact match — closest retrieved authority: ${verdict.suggestion}` };
    }
    if (verdict.status === 'unmatched') return { status: 'unverified', note: GATE_DESCRIPTIONS.unverified };
    return { status: 'unverified', note: verdict.reason };
}

export function gateStatusForMarker(markerIndex: number, citation: string | null, check: CitationCheckLike): { status: GateStatus; note: string } {
    if (!check) return { status: 'unverified', note: 'No citation gate ran for this answer.' };
    const markerForm = `[${markerIndex}]`;
    const markerVerdict = check.verdicts.find((verdict) => normalize(verdict.citation) === markerForm);
    if (markerVerdict) {
        if (markerVerdict.status === 'verified') return { status: 'verified', note: `Resolves to authority ${markerIndex} in the retrieved set.` };
        if (markerVerdict.status === 'unmatched' && markerVerdict.suggestion) {
            return { status: 'partial', note: `No exact match — closest retrieved authority: ${markerVerdict.suggestion}` };
        }
        if (markerVerdict.status === 'unmatched') return { status: 'unverified', note: GATE_DESCRIPTIONS.unverified };
        return { status: 'unverified', note: markerVerdict.reason };
    }
    if (citation) {
        const byCitation = gateStatusForCitation(citation, check);
        if (byCitation.status !== 'uncited') return byCitation;
        return { status: 'partial', note: 'In the retrieved set; this inline reference was not separately gate-checked.' };
    }
    return { status: 'unverified', note: `Reference [${markerIndex}] has no retrieved authority behind it.` };
}
